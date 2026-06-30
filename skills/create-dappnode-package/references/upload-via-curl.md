# Upload a dev image through `/mcp` with curl

Use this when the MCP upload tools are available but the model/tooling cannot
safely carry a large base64 chunk through a visible tool call. This is not the
admin `/upload` endpoint. It calls the same MCP tools over direct JSON-RPC:

1. `dappnode_begin_dev_image_upload`
2. `dappnode_append_dev_image_upload_chunk`
3. `dappnode_finish_dev_image_upload`

You need:

- `MCP_URL`: full DAppNode MCP URL, usually `https://my.dappnode/mcp`.
- `MCP_BEARER`: the MCP API key used in `Authorization: Bearer`.
- `TAR`: the local `docker save` tarball.
- `jq`, `curl`, `dd`, `base64`, `shasum`, and `stat`.

The bearer token is client-specific. Generate or rotate it in the DAppNode UI
under **System > Advanced > MCP API key**. If a client stores its MCP config
locally, reuse that same token; for example, if you are using opencode, look in
`~/.config/opencode/opencode.jsonc` for the MCP server bearer token.

Do not build a huge JSON-RPC request in an argv string. On macOS, commands like
`curl --data-binary "$body"` hit the process argument-size limit once the body is
large enough. Stream the body to curl and use `--data-binary @-`.

```bash
#!/usr/bin/env bash
set -euo pipefail

: "${MCP_URL:?Set MCP_URL, for example https://my.dappnode/mcp}"
: "${MCP_BEARER:?Set MCP_BEARER to the DAppNode MCP API key}"
: "${TAR:?Set TAR to the docker save tarball path}"

CHUNK_BYTES="${CHUNK_BYTES:-1048576}"

file_size() {
  if stat -f%z "$1" >/dev/null 2>&1; then
    stat -f%z "$1"
  else
    stat -c%s "$1"
  fi
}

json_string() {
  jq -Rn --arg v "$1" '$v'
}

post_mcp() {
  curl -fsS "$MCP_URL" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "Authorization: Bearer $MCP_BEARER" \
    --data-binary @-
}

mcp_tool_output() {
  local response_file="$1"

  if jq -e '.error != null' "$response_file" >/dev/null; then
    jq -c '.error' "$response_file" >&2
    return 1
  fi

  if jq -e '.result.isError == true' "$response_file" >/dev/null; then
    jq -r '.result.content[0].text // "MCP tool error"' "$response_file" >&2
    return 1
  fi

  jq -r '.result.content[0].text' "$response_file" | jq -c '.'
}

size_bytes="$(file_size "$TAR")"
sha256="$(shasum -a 256 "$TAR" | awk '{print $1}')"
file_name="$(basename "$TAR")"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

begin_response="$tmp_dir/begin.json"
sha_json="$(json_string "$sha256")"
file_json="$(json_string "$file_name")"

printf '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"dappnode_begin_dev_image_upload","arguments":{"sizeBytes":%s,"sha256":%s,"fileName":%s}}}\n' \
  "$size_bytes" "$sha_json" "$file_json" \
  | post_mcp > "$begin_response"

begin_json="$(mcp_tool_output "$begin_response")"
upload_id="$(printf '%s\n' "$begin_json" | jq -r '.uploadId')"
max_chunk_bytes="$(printf '%s\n' "$begin_json" | jq -r '.maxChunkBytes')"

if [ "$CHUNK_BYTES" -gt "$max_chunk_bytes" ]; then
  CHUNK_BYTES="$max_chunk_bytes"
fi

upload_id_json="$(json_string "$upload_id")"
offset=0
chunk_index=0
request_id=2

while [ "$offset" -lt "$size_bytes" ]; do
  part="$tmp_dir/chunk.bin"
  append_response="$tmp_dir/append-$chunk_index.json"

  dd if="$TAR" of="$part" bs="$CHUNK_BYTES" skip="$chunk_index" count=1 2>/dev/null
  raw_bytes="$(file_size "$part")"
  [ "$raw_bytes" -gt 0 ] || break

  {
    printf '{"jsonrpc":"2.0","id":%s,"method":"tools/call","params":{"name":"dappnode_append_dev_image_upload_chunk","arguments":{"uploadId":%s,"offset":%s,"chunkBase64":"' \
      "$request_id" "$upload_id_json" "$offset"
    base64 < "$part" | tr -d '\n'
    printf '"}}}\n'
  } | post_mcp > "$append_response"

  mcp_tool_output "$append_response" >/dev/null
  offset=$((offset + raw_bytes))
  chunk_index=$((chunk_index + 1))
  request_id=$((request_id + 1))
  printf 'uploaded %s/%s bytes\n' "$offset" "$size_bytes" >&2
done

finish_response="$tmp_dir/finish.json"
printf '{"jsonrpc":"2.0","id":%s,"method":"tools/call","params":{"name":"dappnode_finish_dev_image_upload","arguments":{"uploadId":%s}}}\n' \
  "$request_id" "$upload_id_json" \
  | post_mcp > "$finish_response"

mcp_tool_output "$finish_response" | jq -r '.imageFileId'
```

Example:

```bash
MCP_URL="https://my.dappnode/mcp" \
MCP_BEARER="paste-or-read-your-token-here" \
TAR="my-package.dnp.dappnode.eth.tar" \
CHUNK_BYTES=1048576 \
bash upload-dev-image-via-mcp.sh
```

The command prints the `imageFileId`. Pass that value to
`dappnode_install_dev_package` before the upload expires.
