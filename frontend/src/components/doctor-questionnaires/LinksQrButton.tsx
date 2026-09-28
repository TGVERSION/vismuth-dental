/**
 * «Ссылки и QR-код» — по макету кнопка есть, но окно со ссылками врача и
 * клиники делается отдельной задачей.
 *
 * `aria-disabled`, а не `disabled`: у отключённой кнопки подсказка `title`
 * показывается не во всех браузерах. Подсказку для экранного диктора
 * дублирует скрытый текст.
 */
export const LinksQrButton = () => (
  <span title="Появится позже" className="block shrink-0">
    <button
      type="button"
      aria-disabled="true"
      className="h-13 w-full cursor-not-allowed rounded-xl bg-white px-6 text-[#5D8CF1] opacity-60"
    >
      Ссылки и QR-код
      <span className="sr-only"> — появится позже</span>
    </button>
  </span>
);
