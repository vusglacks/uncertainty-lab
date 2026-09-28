// 되돌릴 수 없는 동작(삭제) 전에 보여주는 확인 창.
// 브라우저 기본 confirm()은 이 앱의 미리보기 환경에서 자동으로 취소돼버려서
// (팝업 자체가 안 뜨고 조용히 false를 반환) 직접 화면 안에 만들어 쓴다.
export default function ConfirmDialog({ open, message, confirmLabel = '삭제', onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg">
        <p className="text-sm text-slate-700">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
