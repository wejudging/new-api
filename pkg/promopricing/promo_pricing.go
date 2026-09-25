package promopricing

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// Campaign is the persisted limited-time pricing campaign shape. Discount is
// a multiplier: 0 means free, 0.5 means half price, and 1 means no discount.
type Campaign struct {
	ID        string   `json:"id,omitempty"`
	Enabled   bool     `json:"enabled"`
	Title     string   `json:"title"`
	ExpiresAt string   `json:"expiresAt"`
	Discount  float64  `json:"discount"`
	Models    []string `json:"models"`
}

// DiscountForModels returns the most specific active campaign multiplier for
// any supplied model identity. Exact patterns beat wildcards; among wildcard
// patterns the one with the longest literal part wins. The first argument is
// normally the billing name, followed by the requested/original name.
func DiscountForModels(modelNames ...string) (float64, bool) {
	raw := ""
	common.OptionMapRWMutex.RLock()
	raw = common.OptionMap["PromoPricing"]
	common.OptionMapRWMutex.RUnlock()

	campaigns := parseCampaigns(raw)
	if len(campaigns) == 0 {
		return 1, false
	}
	now := time.Now()
	bestScore := -1
	best := 1.0
	for _, campaign := range campaigns {
		if !campaignActive(campaign, now) {
			continue
		}
		for _, modelName := range modelNames {
			if modelName == "" {
				continue
			}
			if score := matchScore(campaign.Models, modelName); score > bestScore {
				bestScore = score
				best = campaign.Discount
			}
		}
	}
	if bestScore < 0 {
		return 1, false
	}
	return best, true
}

func parseCampaigns(raw string) []Campaign {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	var value any
	if err := json.Unmarshal([]byte(raw), &value); err != nil {
		return nil
	}
	items, ok := value.([]any)
	if !ok {
		items = []any{value}
	}
	campaigns := make([]Campaign, 0, len(items))
	for _, item := range items {
		encoded, err := json.Marshal(item)
		if err != nil {
			continue
		}
		var campaign Campaign
		if err := json.Unmarshal(encoded, &campaign); err != nil {
			continue
		}
		if campaign.Discount < 0 || campaign.Discount > 1 {
			continue
		}
		campaigns = append(campaigns, campaign)
	}
	return campaigns
}

func campaignActive(campaign Campaign, now time.Time) bool {
	if !campaign.Enabled || len(campaign.Models) == 0 {
		return false
	}
	if strings.TrimSpace(campaign.ExpiresAt) == "" {
		return true
	}
	expires, err := time.Parse(time.RFC3339, campaign.ExpiresAt)
	return err == nil && expires.After(now)
}

func matchScore(patterns []string, modelName string) int {
	name := strings.ToLower(strings.TrimSpace(modelName))
	if name == "" {
		return -1
	}
	best := -1
	for _, pattern := range patterns {
		pattern = strings.ToLower(strings.TrimSpace(pattern))
		if pattern == "" {
			continue
		}
		if pattern == name {
			best = max(best, 1_000_000+len(pattern))
			continue
		}
		if !wildcardMatch(pattern, name) {
			continue
		}
		literalLength := len(strings.ReplaceAll(pattern, "*", ""))
		best = max(best, literalLength*1000)
	}
	return best
}

func wildcardMatch(pattern, value string) bool {
	parts := strings.Split(pattern, "*")
	if len(parts) == 1 {
		return pattern == value
	}
	if parts[0] != "" && !strings.HasPrefix(value, parts[0]) {
		return false
	}
	if parts[len(parts)-1] != "" && !strings.HasSuffix(value, parts[len(parts)-1]) {
		return false
	}
	position := 0
	for _, part := range parts {
		if part == "" {
			continue
		}
		index := strings.Index(value[position:], part)
		if index < 0 {
			return false
		}
		position += index + len(part)
	}
	return true
}
