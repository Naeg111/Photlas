-- Issue#65: 位置情報修正の指摘テーブル
CREATE TABLE location_suggestions (
    id BIGSERIAL PRIMARY KEY,
    photo_id BIGINT NOT NULL REFERENCES photos(photo_id),
    suggester_id BIGINT NOT NULL REFERENCES users(id),
    suggested_latitude DECIMAL(9,6) NOT NULL,
    suggested_longitude DECIMAL(9,6) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    review_token VARCHAR(255) UNIQUE,
    email_sent BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP,
    UNIQUE (photo_id, suggester_id)
);

CREATE INDEX idx_location_suggestions_photo_id ON location_suggestions(photo_id);
CREATE INDEX idx_location_suggestions_status ON location_suggestions(status);
CREATE INDEX idx_location_suggestions_review_token ON location_suggestions(review_token);
