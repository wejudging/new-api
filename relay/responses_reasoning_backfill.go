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

// 默认对所有渠道生效（无需逐个渠道勾选）。渠道「额外设置」里的
// backfill_reasoning_text（见 ChannelOtherSettings）仍可单渠道强制开启。
// 环境变量 REASONING_TEXT_BACKFILL_CHANNELS 用来收窄范围：
//   - 留空（默认）        → 所有渠道
//   - 逗号分隔的渠道 ID   → 只对这些渠道生效
//   - off / none / -     → 全局关闭（仅单渠道勾选项仍生效）
const (
	reasoningTextBackfillEnvKey   = "REASONING_TEXT_BACKFILL_CHANNELS"
	reasoningTextBackfillDefault  = ""
	reasoningTextBackfillDisabled = "off"
)

var (
	reasoningTextBackfillOnce       sync.Once
	reasoningTextBackfillIDs        map[int]struct{}
	reasoningTextBackfillScopeValue reasoningTextBackfillScope
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
		// 只有带 reasoning_text 部件的项才算「已回传思考」。content 里放的是
		// summary_text 等其它部件时，严格上游依旧会 400，必须继续补。
		if strings.TrimSpace(reasoningTextPartsText(item.Get("content"))) != "" {
			return true
		}
		text := strings.TrimSpace(reasoningPartsText(item.Get("summary")))
		if text == "" {
			// 思考被网关放进了 content 的形式（非 reasoning_text 部件）也照抄一份。
			text = strings.TrimSpace(reasoningPartsText(item.Get("content")))
		}
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

// reasoningTextBackfillMode 是全局生效范围，由环境变量 REASONING_TEXT_BACKFILL_CHANNELS 决定：
//
//	留空（默认）  → all：所有渠道都做回填，管理员无需逐个渠道勾选；
//	ID 列表       → whitelist：只有列出的渠道做回填（兼容早期按渠道白名单的用法）；
//	off/none/-    → off：全局关闭，只有渠道「额外设置」里显式勾选的渠道仍然生效。
//
// 之所以默认 all：同一条会话在「只回 summary 的网关」与「严格执行 DeepSeek 规则
// 的渠道」之间互相兜底时，请求最终落到哪一侧取决于选路/重试，管理员很难预判需要
// 勾哪个渠道；漏勾的一个渠道就会让整次请求以 400 结束（该错误不可重试）。
type reasoningTextBackfillScope int

const (
	reasoningTextBackfillScopeAll reasoningTextBackfillScope = iota
	reasoningTextBackfillScopeWhitelist
	reasoningTextBackfillScopeOff
)

// reasoningTextPartsText 只取 content[] 里 type=reasoning_text 部件的文本；
// 其它类型（summary_text 等）不计入，避免误判为「已经回传了思考」。
func reasoningTextPartsText(parts gjson.Result) string {
	if !parts.IsArray() {
		return ""
	}
	var builder strings.Builder
	parts.ForEach(func(_, part gjson.Result) bool {
		if part.Get("type").String() != "reasoning_text" {
			return true
		}
		builder.WriteString(part.Get("text").String())
		return true
	})
	return builder.String()
}

// reasoningTextBackfillEnabled 判定该渠道是否要做回填：
// 渠道「额外设置」勾选项始终优先（即使全局关闭也可单渠道开启）；否则按全局范围决定。
func reasoningTextBackfillEnabled(info *relaycommon.RelayInfo) bool {
	if info == nil || info.ChannelMeta == nil {
		return false
	}
	if info.ChannelOtherSettings.BackfillReasoningText {
		return true
	}
	switch resolveReasoningTextBackfillScope() {
	case reasoningTextBackfillScopeOff:
		return false
	case reasoningTextBackfillScopeWhitelist:
		_, ok := reasoningTextBackfillChannels()[info.GetChannelID()]
		return ok
	default:
		return true
	}
}

func resolveReasoningTextBackfillScope() reasoningTextBackfillScope {
	reasoningTextBackfillOnce.Do(func() {
		raw := common.GetEnvOrDefaultString(reasoningTextBackfillEnvKey, reasoningTextBackfillDefault)
		reasoningTextBackfillIDs = parseReasoningTextBackfillChannels(raw)
		reasoningTextBackfillScopeValue = parseReasoningTextBackfillScope(raw)
	})
	return reasoningTextBackfillScopeValue
}

func reasoningTextBackfillChannels() map[int]struct{} {
	resolveReasoningTextBackfillScope()
	return reasoningTextBackfillIDs
}

func parseReasoningTextBackfillScope(raw string) reasoningTextBackfillScope {
	value := strings.TrimSpace(raw)
	if value == "" {
		return reasoningTextBackfillScopeAll
	}
	switch strings.ToLower(value) {
	case reasoningTextBackfillDisabled, "none", "-":
		return reasoningTextBackfillScopeOff
	}
	// 配置了值却解析不出任何渠道 ID：按「有意的白名单」处理，
	// 保持与早期版本一致（不因为写错一个 ID 就全局生效）。
	return reasoningTextBackfillScopeWhitelist
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
