export function isCallbackHandled(ctx) {
    const currentId = ctx.callbackQuery?.id;
    if (!currentId) return false;
  
    if (ctx.session.lastCallbackId === currentId) {
      return true; // дубликат
    }
  
    ctx.session.lastCallbackId = currentId;
    return false;
}
  