# ローカル開発・CI 用の PostgreSQL + PostGIS イメージ（docker-compose.yml の db サービス）
#
# postgis/postgis は Intel(amd64) 版しか公開されておらず、Apple Silicon ではエミュレーションになるため、
# Docker 公式の postgres イメージを土台に PostGIS を追加して、amd64 / arm64 の両方でネイティブに動かす。
#
# - PostgreSQL は本番（AWS RDS）と同じマイナーバージョンに合わせる（infra/terraform/envs/prod/rds.tf の engine_version）
# - PostGIS 拡張の有効化（CREATE EXTENSION postgis）は Flyway マイグレーション V44 が行うため、ここではインストールのみ
# - 本番は RDS のため、このイメージは本番では使われない
FROM postgres:17.9-bookworm

# PostgreSQL 公式 apt リポジトリ（ベースイメージで設定済み）から入れる。
# 3.5 系は配布が終了しているため 3.6 系に固定する。配布が終わってビルドできなくなったら、
# 本番 RDS の PostGIS バージョンを確認したうえで更新する。
ENV POSTGIS_VERSION=3.6.*

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      "postgresql-${PG_MAJOR}-postgis-3=${POSTGIS_VERSION}" \
      "postgresql-${PG_MAJOR}-postgis-3-scripts=${POSTGIS_VERSION}" \
 && rm -rf /var/lib/apt/lists/*
