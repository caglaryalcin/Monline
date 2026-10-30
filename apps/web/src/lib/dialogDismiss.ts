/** Dialogs can report opening as well as closing; pending writes keep them open. */
export function dialogDismissHandler(onClose: () => void, blocked = false) {
  return (open: boolean) => {
    if (!open && !blocked) onClose();
  };
}
