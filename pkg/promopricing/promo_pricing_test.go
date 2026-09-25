package promopricing

import (
	"testing"
	"time"
)

func TestWildcardMatch(t *testing.T) {
	for _, test := range []struct {
		pattern string
		value   string
		want    bool
	}{
		{"big-*", "big-pickle", true},
		{"*nemotron*", "nemotron-3.5", true},
		{"ling-3.0", "ling-3.0", true},
		{"big-*", "pickle", false},
	} {
		if got := wildcardMatch(test.pattern, test.value); got != test.want {
			t.Fatalf("wildcardMatch(%q, %q) = %v, want %v", test.pattern, test.value, got, test.want)
		}
	}
}

func TestCampaignActiveAllowsZeroDiscount(t *testing.T) {
	campaign := Campaign{Enabled: true, Discount: 0, Models: []string{"big-pickle"}}
	if !campaignActive(campaign, time.Now()) {
		t.Fatal("zero-discount campaign should be active")
	}
}

func TestMatchScorePrefersExactAndSpecificPatterns(t *testing.T) {
	exact := matchScore([]string{"big-pickle"}, "big-pickle")
	wildcard := matchScore([]string{"big-*"}, "big-pickle")
	if exact <= wildcard {
		t.Fatalf("exact score %d should beat wildcard score %d", exact, wildcard)
	}
}
