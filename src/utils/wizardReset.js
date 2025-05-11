/**
 * Сброс состояния Wizard-сцены.
 * Очищает состояние и переводит на первый шаг.
 */
export function resetWizard(ctx) {
  ctx.wizard.state = {};
  ctx.wizard.selectStep(0);
}
