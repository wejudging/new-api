package relay

import (
	"sync"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/tidwall/gjson"
)

func backfillTestRelayInfo(channelID int, enabled bool) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		ChannelId:            channelID,
		ChannelOtherSettings: dto.ChannelOtherSettings{BackfillReasoningText: enabled},
	}}
}

func resetReasoningTextBackfillCache(t *testing.T) {
	t.Helper()
	reasoningTextBackfillOnce = sync.Once{}
	reasoningTextBackfillIDs = nil
	t.Cleanup(func() {
		reasoningTextBackfillOnce = sync.Once{}
		reasoningTextBackfillIDs = nil
	})
}

const backfillTestBody = `{"model":"deepseek-v4.1-flash","tools":[{"type":"function","name":"exec_command"}],` +
	`"input":[{"role":"user","content":[{"type":"input_text","text":"hi"}]},` +
	`{"type":"reasoning","id":"rs_1","summary":[{"type":"summary_text","text":"thinking here"}]},` +
	`{"type":"function_call","call_id":"c1","name":"exec_command","arguments":"{}"},` +
	`{"type":"function_call_output","call_id":"c1","output":"hi"}]}`

func TestBackfillResponsesReasoningTextAddsContentWhenChannelOptedIn(t *testing.T) {
	resetReasoningTextBackfillCache(t)
	out, err := BackfillResponsesReasoningText(backfillTestRelayInfo(1, true), []byte(backfillTestBody))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	item := gjson.GetBytes(out, `input.#(type=="reasoning")`)
	if !item.Exists() {
		t.Fatalf("reasoning item lost: %s", out)
	}
	content := item.Get("content")
	if !content.IsArray() || len(content.Array()) != 1 {
		t.Fatalf("content not backfilled: %s", item.Raw)
	}
	if got := content.Array()[0].Get("type").String(); got != "reasoning_text" {
		t.Fatalf("unexpected content type %q", got)
	}
	if got := content.Array()[0].Get("text").String(); got != "thinking here" {
		t.Fatalf("unexpected backfilled text %q", got)
	}
	if got := item.Get("id").String(); got != "rs_1" {
		t.Fatalf("id was modified: %q", got)
	}
	if got := item.Get("summary.0.text").String(); got != "thinking here" {
		t.Fatalf("summary was modified: %q", got)
	}
	if got := gjson.GetBytes(out, "input.2.type").String(); got != "function_call" {
		t.Fatalf("unrelated item changed: %q", got)
	}
	if got := gjson.GetBytes(out, "input.3.output").String(); got != "hi" {
		t.Fatalf("unrelated item changed: %q", got)
	}
}

func TestBackfillResponsesReasoningTextSkipsWithoutOptIn(t *testing.T) {
	resetReasoningTextBackfillCache(t)
	out, err := BackfillResponsesReasoningText(backfillTestRelayInfo(187, false), []byte(backfillTestBody))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(out) != backfillTestBody {
		t.Fatalf("body changed for channel without opt-in: %s", out)
	}
}

func TestBackfillResponsesReasoningTextEnvWhitelist(t *testing.T) {
	resetReasoningTextBackfillCache(t)
	t.Setenv(reasoningTextBackfillEnvKey, "999")
	if !reasoningTextBackfillEnabled(backfillTestRelayInfo(999, false)) {
		t.Fatalf("channel listed in env whitelist should be enabled")
	}
	if reasoningTextBackfillEnabled(backfillTestRelayInfo(1, false)) {
		t.Fatalf("channel missing from env whitelist must stay disabled")
	}
	out, err := BackfillResponsesReasoningText(backfillTestRelayInfo(999, false), []byte(backfillTestBody))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(out) == backfillTestBody {
		t.Fatalf("env whitelisted channel should have been backfilled")
	}
}

func TestBackfillResponsesReasoningTextSkipsWithoutTools(t *testing.T) {
	resetReasoningTextBackfillCache(t)
	body := `{"model":"deepseek-v4.1-flash","input":[{"type":"reasoning","id":"rs_1","summary":[{"type":"summary_text","text":"x"}]}]}`
	out, err := BackfillResponsesReasoningText(backfillTestRelayInfo(1, true), []byte(body))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(out) != body {
		t.Fatalf("body changed without tools: %s", out)
	}
}

func TestBackfillResponsesReasoningTextKeepsExistingContent(t *testing.T) {
	resetReasoningTextBackfillCache(t)
	body := `{"tools":[{"type":"function","name":"f"}],"input":[{"type":"reasoning","id":"rs_1","encrypted_content":"abc",` +
		`"content":[{"type":"reasoning_text","text":"real thinking"}],"summary":[{"type":"summary_text","text":"short"}]}]}`
	out, err := BackfillResponsesReasoningText(backfillTestRelayInfo(1, true), []byte(body))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(out) != body {
		t.Fatalf("body changed despite existing reasoning_text: %s", out)
	}
}

func TestBackfillResponsesReasoningTextSkipsReasoningWithoutText(t *testing.T) {
	resetReasoningTextBackfillCache(t)
	body := `{"tools":[{"type":"function","name":"f"}],"input":[{"type":"reasoning","id":"rs_1"}]}`
	out, err := BackfillResponsesReasoningText(backfillTestRelayInfo(1, true), []byte(body))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(out) != body {
		t.Fatalf("body changed without any text: %s", out)
	}
}

func TestBackfillResponsesReasoningTextHandlesNilInfo(t *testing.T) {
	resetReasoningTextBackfillCache(t)
	out, err := BackfillResponsesReasoningText(nil, []byte(backfillTestBody))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(out) != backfillTestBody {
		t.Fatalf("body changed for nil relay info: %s", out)
	}
}

func TestParseReasoningTextBackfillChannels(t *testing.T) {
	cases := []struct {
		raw  string
		want []int
	}{
		{"228", []int{228}},
		{"228, 229 ,abc, -3, 0", []int{228, 229}},
		{"off", nil},
		{"NONE", nil},
		{"-", nil},
		{"", nil},
	}
	for _, tc := range cases {
		got := parseReasoningTextBackfillChannels(tc.raw)
		if len(got) != len(tc.want) {
			t.Fatalf("parse %q = %v, want %v", tc.raw, got, tc.want)
		}
		for _, id := range tc.want {
			if _, ok := got[id]; !ok {
				t.Fatalf("parse %q missing %d: %v", tc.raw, id, got)
			}
		}
	}
}
