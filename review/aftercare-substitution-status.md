# 臨時代課實作與安全限制（2026-10-15）

## 已部署至 Supabase
- `aftercare_substitution_audit` 稽核表（RLS 啟用；不允許一般 API 直接讀寫）。
- `trg_block_aftercare_double_booking`：同位教師在同一日期不可有兩個不同課後班的有效「每日排班」。
- `assign_aftercare_substitute`：僅管理員可呼叫，檢查代課教師、日期、代課衝突；寫入排班及稽核紀錄的交易會一起完成或一起回滾。
- 對原教師具有「固定課後班」的案件，**目前會拒絕修改**（FIXED_ASSIGNMENT_OVERRIDE_NOT_YET_SUPPORTED），避免固定指派在代課當日意外繼續生效。

## 尚未完成，不可視為正式代課功能
1. 新增日期專用的固定指派例外／暫停規則，並讓 `teacher_can_access_pickup_child`、`get_teacher_roster_overview`、`teacher-item-notify` 統一使用有效班級排班演算法。
2. 需要同時把 `teacher_complete_pickup` 的權限查詢改成同一有效排班來源。
3. 行政後台代課表單，含衝突驗證與歷史紀錄。
4. 代課申請核定後發送替補老師、同班共同老師通知，需具備冪等事件鍵。
5. 測試情境：固定老師請假、兩位共同帶班的一位請假、同日其他班代課、已排同日不同班、排班日過後自動恢復、LINE 未綁定、通知失敗重試。

不要在正式端使用尚未驗收的代課 RPC 作為管理流程。
