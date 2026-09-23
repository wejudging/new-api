package relay

import (
	"fmt"
	"strconv"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// 主开关是渠道「额外设置」里的 backfill_reasoning_text（见 ChannelOtherSettings）。
// 下面这个环境变量是批量兜底：填渠道 ID（逗号分隔）即可让这些渠道免勾选生效，
// 留空表示不额外启用任何渠道。
const (
	reasoningTextBackfillEnvKey   = "REASONING_TEXT_BACKFILL_CHANNELS"
	reasoningTextBackfillDefault  = ""
	reasoningTextBackfillDisabled = "off"
)

var (
	reasoningTextBackfillOnce sync.Once
	reasoningTextBackfillIDs  map[int]struct{}
)

// BackfillResponsesReasoningText 在 Responses 请求发往上游之前，把 input[] 里
// "只有 summary、没有 reasoning_text" 的 reasoning 项补出 content[].reasoning_text。
//
// 背景（DeepSeek 思考模式）：
//
//	只要请求带 tools，历史里每一轮 assistant 的思考内容都必须以 reasoning_content /
//	reasoning_text 原样回传，否则上游返回 400：
//	  The `reasoning_text` in the thinking mode must be passed back to the API.
//
// 但各家网关回给客户端的形态不一致——B.AI 这类老网关会把思考塞进 summary，
// 而原生 DeepSeek Responses 透传的渠道（如 OpenCode）会给出 content[].reasoning_text。
// 客户端只会照收到的形态回传，于是同一条会话在两个渠道之间切换（互为兜底）时，
// 严格的一侧会拒掉只有 summary 的历史。
//
// 这里补一份等文本的 content，使历史项始终带 reasoning_text，从而让这两类渠道可以
// 无缝互相兜底。只补不删：id / encrypted_content / summary 全部原样保留。
func BackfillResponsesReasoningText(info *relaycommon.RelayInfo, body []byte) ([]byte, error) {
	if info == nil || len(body) == 0 {
		return body, nil
	}
	if !reasoningTextBackfillEnabled(info) {
		return body, nil
	}
	// DeepSeek 的规则只在请求带 tools 时生效；不带 tools 就完全不碰。
	tools := gjson.GetBytes(body, "tools")
	if !tools.IsArray() || len(tools.Array()) == 0 {
		return body, nil
	}
	input := gjson.GetBytes(body, "input")
	if !input.IsArray() {
		return body, nil
	}

	updated := body
	patched := 0
	input.ForEach(func(index, item gjson.Result) bool {
		if !item.IsObject() || item.Get("type").String() != "reasoning" {
			return true
		}
		if strings.TrimSpace(reasoningPartsText(item.Get("content"))) != "" {
			return true
		}
		text := strings.TrimSpace(reasoningPartsText(item.Get("summary")))
		if text == "" {
			return true
		}
		next, err := sjson.SetBytes(updated, fmt.Sprintf("input.%d.content", index.Int()),
			[]map[string]any{{"type": "reasoning_text", "text": text}})
		if err != nil {
			return true
		}
		updated = next
		patched++
		return true
	})
	if patched == 0 {
		return body, nil
	}
	return updated, nil
}

// reasoningPartsText 从 content / summary 这类数组里取文本，兼容
// [{"type":"reasoning_text","text":"..."}]、[{"type":"summary_text","text":"..."}]
// 以及直接给字符串这两种写法。
func reasoningPartsText(parts gjson.Result) string {
	if !parts.Exists() {
		return ""
	}
	if parts.Type == gjson.String {
		return parts.String()
	}
	var builder strings.Builder
	parts.ForEach(func(_, part gjson.Result) bool {
		if text := part.Get("text"); text.Exists() {
			builder.WriteString(text.String())
		}
		return true
	})
	return builder.String()
}

// reasoningTextBackfillEnabled 判定该渠道是否要做回填：
// 渠道「额外设置」勾选项优先；环境变量白名单作为批量兜底（默认空）。
func reasoningTextBackfillEnabled(info *relaycommon.RelayInfo) bool {
	if info == nil || info.ChannelMeta == nil {
		return false
	}
	if info.ChannelOtherSettings.BackfillReasoningText {
		return true
	}
	_, ok := reasoningTextBackfillChannels()[info.GetChannelID()]
	return ok
}

func reasoningTextBackfillChannels() map[int]struct{} {
	reasoningTextBackfillOnce.Do(func() {
		reasoningTextBackfillIDs = parseReasoningTextBackfillChannels(
			common.GetEnvOrDefaultString(reasoningTextBackfillEnvKey, reasoningTextBackfillDefault))
	})
	return reasoningTextBackfillIDs
}

func parseReasoningTextBackfillChannels(raw string) map[int]struct{} {
	ids := make(map[int]struct{})
	value := strings.TrimSpace(raw)
	if value == "" {
		return ids
	}
	switch strings.ToLower(value) {
	case reasoningTextBackfillDisabled, "none", "-":
		return ids
	}
	for _, part := range strings.Split(value, ",") {
		id, err := strconv.Atoi(strings.TrimSpace(part))
		if err != nil || id <= 0 {
			continue
		}
		ids[id] = struct{}{}
	}
	return ids
}
