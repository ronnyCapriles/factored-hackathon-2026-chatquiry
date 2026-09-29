from app.orchestrator.llm import from_converse, to_converse


def test_history_is_translated_and_same_role_turns_are_merged():
    history = [
        {"role": "user", "content": [{"type": "text", "text": "<turn_context>…</turn_context>"}, {"type": "text", "text": "mi transferencia"}]},
        {
            "role": "assistant",
            "content": [{"type": "thinking", "thinking": "", "signature": "x"}, {"type": "tool_use", "id": "t1", "name": "find_transactions", "input": {}}],
        },
        {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "t1", "content": '{"matches": []}'}]},
        {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "t2", "content": "denied", "is_error": True}, {"type": "text", "text": " "}]},
        {"role": "assistant", "content": "No encuentro movimientos."},
    ]
    out = to_converse(history)
    assert [m["role"] for m in out] == ["user", "assistant", "user", "assistant"]
    assert out[1]["content"] == [{"toolUse": {"toolUseId": "t1", "name": "find_transactions", "input": {}}}]
    assert [b["toolResult"]["status"] for b in out[2]["content"]] == ["success", "error"]
    assert out[3]["content"] == [{"text": "No encuentro movimientos."}]


def test_reply_blocks_come_back_in_the_orchestrator_format():
    blocks = [{"text": "Déjame revisar."}, {"toolUse": {"toolUseId": "abc", "name": "get_transaction", "input": {"transaction_id": "TRX-1"}}}]
    assert from_converse(blocks) == [
        {"type": "text", "text": "Déjame revisar."},
        {"type": "tool_use", "id": "abc", "name": "get_transaction", "input": {"transaction_id": "TRX-1"}},
    ]
