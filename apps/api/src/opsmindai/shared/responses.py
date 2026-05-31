from opsmindai.shared.trace import get_trace_id


def success_response(data):
    return {"success": True, "data": data, "trace_id": get_trace_id()}


def error_response(code: str, message: str, details=None):
    return {
        "success": False,
        "error": {"code": code, "message": message, "details": details},
        "trace_id": get_trace_id(),
    }
