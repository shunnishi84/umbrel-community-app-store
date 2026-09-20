#!/bin/bash
cd /workspace
while true; do
  # 前回の続きがあれば --continue で復元、なければ新規セッション
  claude remote-control --continue || claude remote-control
  sleep 5
done
