
resource "aws_wafv2_web_acl" "main" {
  description = "Photlas main WAF with rate limiting rules - Issue#94"
  name        = "photlas-waf-main"
  region      = "ap-northeast-1"
  rule_json   = null
  scope       = "REGIONAL"
  tags = {
    CostCenter  = "waf"
    Environment = "production"
    ManagedBy   = "Issue-94"
    Project     = "Photlas"
  }
  token_domains = []
  custom_response_body {
    # 実機のキー順(error,code,message,retryAfter)に一致させるためリテラル文字列で記述
    # （jsonencode はキーをソートしてしまい no-op にならないため）
    content      = "{\"error\":\"Too Many Requests\",\"code\":\"RATE_LIMIT_EXCEEDED\",\"message\":\"Too many requests. Please retry after some time.\",\"retryAfter\":60}"
    content_type = "APPLICATION_JSON"
    key          = "RateLimitExceeded"
  }
  default_action {
    allow {
    }
  }
  rule {
    name     = "AuthRateLimit"
    priority = 10
    action {
      count {
      }
    }
    statement {
      rate_based_statement {
        aggregate_key_type    = "FORWARDED_IP"
        evaluation_window_sec = 300
        limit                 = 100
        forwarded_ip_config {
          fallback_behavior = "NO_MATCH"
          header_name       = "X-Forwarded-For"
        }
        scope_down_statement {
          and_statement {
            statement {
              byte_match_statement {
                positional_constraint = "EXACTLY"
                search_string         = "api.photlas.jp"
                field_to_match {
                  single_header {
                    name = "host"
                  }
                }
                text_transformation {
                  priority = 0
                  type     = "LOWERCASE"
                }
              }
            }
            statement {
              byte_match_statement {
                positional_constraint = "STARTS_WITH"
                search_string         = "/api/v1/auth/"
                field_to_match {
                  uri_path {
                  }
                }
                text_transformation {
                  priority = 0
                  type     = "LOWERCASE"
                }
              }
            }
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AuthRateLimit"
      sampled_requests_enabled   = true
    }
  }
  rule {
    name     = "GeneralRateLimit"
    priority = 20
    action {
      count {
      }
    }
    statement {
      rate_based_statement {
        aggregate_key_type    = "FORWARDED_IP"
        evaluation_window_sec = 300
        limit                 = 2000
        forwarded_ip_config {
          fallback_behavior = "NO_MATCH"
          header_name       = "X-Forwarded-For"
        }
        scope_down_statement {
          byte_match_statement {
            positional_constraint = "EXACTLY"
            search_string         = "api.photlas.jp"
            field_to_match {
              single_header {
                name = "host"
              }
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "GeneralRateLimit"
      sampled_requests_enabled   = true
    }
  }
  rule {
    name     = "StagingLooseLimit"
    priority = 30
    action {
      count {
      }
    }
    statement {
      rate_based_statement {
        aggregate_key_type    = "FORWARDED_IP"
        evaluation_window_sec = 300
        limit                 = 5000
        forwarded_ip_config {
          fallback_behavior = "NO_MATCH"
          header_name       = "X-Forwarded-For"
        }
        scope_down_statement {
          byte_match_statement {
            positional_constraint = "EXACTLY"
            search_string         = "test-api.photlas.jp"
            field_to_match {
              single_header {
                name = "host"
              }
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "StagingLooseLimit"
      sampled_requests_enabled   = true
    }
  }
  rule {
    name     = "AmazonIpReputationList"
    priority = 100
    override_action {
      count {
      }
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAmazonIpReputationList"
        vendor_name = "AWS"
        version     = null
        rule_action_override {
          name = "AWSManagedIPReputationList"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "AWSManagedReconnaissanceList"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "AWSManagedIPDDoSList"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        scope_down_statement {
          byte_match_statement {
            positional_constraint = "EXACTLY"
            search_string         = "api.photlas.jp"
            field_to_match {
              single_header {
                name = "host"
              }
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AmazonIpReputationList"
      sampled_requests_enabled   = true
    }
  }
  rule {
    name     = "CommonRuleSet"
    priority = 130
    override_action {
      count {
      }
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
        version     = "Version_1.21"
        rule_action_override {
          name = "NoUserAgent_HEADER"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "UserAgent_BadBots_HEADER"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "SizeRestrictions_QUERYSTRING"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "SizeRestrictions_Cookie_HEADER"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "SizeRestrictions_BODY"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "SizeRestrictions_URIPATH"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "EC2MetaDataSSRF_BODY"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "EC2MetaDataSSRF_COOKIE"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "EC2MetaDataSSRF_URIPATH"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "EC2MetaDataSSRF_QUERYARGUMENTS"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "GenericLFI_QUERYARGUMENTS"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "GenericLFI_URIPATH"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "GenericLFI_BODY"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "RestrictedExtensions_URIPATH"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "RestrictedExtensions_QUERYARGUMENTS"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "GenericRFI_QUERYARGUMENTS"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "GenericRFI_BODY"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "GenericRFI_URIPATH"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "CrossSiteScripting_COOKIE"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "CrossSiteScripting_QUERYARGUMENTS"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "CrossSiteScripting_BODY"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "CrossSiteScripting_URIPATH"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        scope_down_statement {
          byte_match_statement {
            positional_constraint = "EXACTLY"
            search_string         = "api.photlas.jp"
            field_to_match {
              single_header {
                name = "host"
              }
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonRuleSet"
      sampled_requests_enabled   = true
    }
  }
  rule {
    name     = "KnownBadInputsRuleSet"
    priority = 110
    override_action {
      count {
      }
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
        version     = "Version_1.25"
        rule_action_override {
          name = "JavaDeserializationRCE_BODY"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "JavaDeserializationRCE_URIPATH"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "JavaDeserializationRCE_QUERYSTRING"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "JavaDeserializationRCE_HEADER"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "Host_localhost_HEADER"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "PROPFIND_METHOD"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "ExploitablePaths_URIPATH"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "Log4JRCE_QUERYSTRING"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "Log4JRCE_BODY"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "Log4JRCE_URIPATH"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "Log4JRCE_HEADER"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "ReactJSRCE_BODY"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        scope_down_statement {
          byte_match_statement {
            positional_constraint = "EXACTLY"
            search_string         = "api.photlas.jp"
            field_to_match {
              single_header {
                name = "host"
              }
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "KnownBadInputsRuleSet"
      sampled_requests_enabled   = true
    }
  }
  rule {
    name     = "SQLiRuleSet"
    priority = 120
    override_action {
      count {
      }
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
        version     = "Version_2.3"
        rule_action_override {
          name = "SQLi_QUERYARGUMENTS"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "SQLi_BODY"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "SQLi_COOKIE"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "SQLi_URIPATH"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "SQLiExtendedPatterns_QUERYARGUMENTS"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "SQLiExtendedPatterns_BODY"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "SQLiExtendedPatterns_URIPATH"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        rule_action_override {
          name = "SQLiExtendedPatterns_HEADER"
          action_to_use {
            block {
              custom_response {
                custom_response_body_key = "RateLimitExceeded"
                response_code            = 429
                response_header {
                  name  = "Retry-After"
                  value = "60"
                }
              }
            }
          }
        }
        scope_down_statement {
          byte_match_statement {
            positional_constraint = "EXACTLY"
            search_string         = "api.photlas.jp"
            field_to_match {
              single_header {
                name = "host"
              }
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "SQLiRuleSet"
      sampled_requests_enabled   = true
    }
  }
  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "photlas-waf-main"
    sampled_requests_enabled   = true
  }
}
