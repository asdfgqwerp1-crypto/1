#!/usr/bin/env bash
echo "=== SafariSpoof Test Servers ==="
for spec in "8080:HTTP" "8443:HTTPS"; do
  port="${spec%%:*}"
  name="${spec##*:}"
  if command -v lsof >/dev/null 2>&1 && lsof -ti:"$port" >/dev/null 2>&1; then
    pid=$(lsof -ti:"$port" | head -1)
    code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$port/" 2>/dev/null || echo "?")
    if [ "$port" = "8443" ]; then
      code=$(curl -sk -o /dev/null -w "%{http_code}" "https://127.0.0.1:$port/" 2>/dev/null || echo "?")
    fi
    echo "  $name :$port  RUNNING  pid=$pid  localhost=$code"
  else
    echo "  $name :$port  STOPPED"
  fi
done
IP=$(python3 -c "import socket;s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM);s.connect(('8.8.8.8',80));print(s.getsockname()[0]);s.close()" 2>/dev/null || echo "?")
echo ""
echo " URLs for iPhone:"
echo "   http://$IP:8080/fingerprint-diff/"
echo "   https://$IP:8443/webrtc-inspector/"