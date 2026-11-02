#!/bin/zsh
set -e
cd "${0:A:h}"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v npm >/dev/null 2>&1; then
  print "Для запуска нужен Node.js 24."
  read "?Нажмите Enter, чтобы закрыть окно..."
  exit 1
fi
if [ ! -d node_modules ]; then
  npm ci
fi
if [ ! -f dist/index.html ]; then
  npm run build
fi
npm run preview -- --port 4173 --open
