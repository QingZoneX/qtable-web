#!/bin/sh
set -e

# 兜底默认值：Rainbond 会注入 PORT（组件端口），依赖关系会注入 QTABLE_HOST/QTABLE_PORT。
# 若环境变量缺失则回退到默认值，保证镜像可独立运行。
PORT="${PORT:-9100}"
QTABLE_HOST="${QTABLE_HOST:-qtable}"
QTABLE_PORT="${QTABLE_PORT:-9000}"
export PORT QTABLE_HOST QTABLE_PORT

# 关键：只替换我们明确列出的变量。这样 ${PORT}/${QTABLE_HOST}/${QTABLE_PORT}
# 一定会被替换，而 nginx 内置变量（$host / $remote_addr / $http_upgrade / $scheme 等）
# 不会被 envsubst 误替换。彻底绕开 nginx 官方镜像 20-envsubst-on-templates.sh
# 的 NGINX_ENVSUBST_* 白名单/黑名单语义（版本间有破坏性变更）。
# 模板刻意不放在 /etc/nginx/templates，避免官方镜像的 20-envsubst-on-templates.sh
# 扫描或覆盖它。该日志也是确认 Rainbond 正在运行此版本镜像的标识。
template=/opt/qtable-ui/nginx.conf.template
config=/etc/nginx/conf.d/default.conf
echo "QTableUI: rendering nginx config (port=${PORT}, backend=${QTABLE_HOST}:${QTABLE_PORT})"
envsubst '${PORT} ${QTABLE_HOST} ${QTABLE_PORT}' \
    < "$template" \
    > "$config"
