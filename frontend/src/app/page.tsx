export default function Home() {
  return (
    <div className="conteiner flex min-h-screen items-center justify-center bg-white">
      <main className="flex min-h-screen w-full max-w-4xl flex-col gap-12 px-auto py-15 bg-white">
        <p className="text-[40px] pl-6 font-semibold leading-[150%]">
          Протокол консультации терапевта №1
        </p>
        <div className="flex gap-9 flex-col">
          <div className="flex gap-2 flex-col">
            <p className="text-[30px] pl-6 font-medium leading-[140%]">
              Жалобы
            </p>
            <input
              className="ml-6 border-0 focus:border-0 focus:outline-none focus:ring-0"
              placeholder="Введите..."
            />
          </div>
          <div className="flex gap-2 flex-col">
            <p className="text-[30px] pl-6 font-medium leading-[140%]">
              Анамнез заболевания
            </p>
            <input
              className="ml-6 border-0 focus:border-0 focus:outline-none focus:ring-0"
              placeholder="Введите..."
            />
          </div>
          <div className="flex gap-2 flex-col">
            <p className="text-[30px] pl-6 font-medium leading-[140%]">
              История заболевания
            </p>
            <input
              className="ml-6 border-0 focus:border-0 focus:outline-none focus:ring-0"
              placeholder="Введите..."
            />
          </div>
          <div className="flex gap-2 flex-col">
            <p className="text-[30px] pl-6 font-medium leading-[140%]">
              Анамнез жизни
            </p>
            <input
              className="ml-6 border-0 focus:border-0 focus:outline-none focus:ring-0"
              placeholder="Введите..."
            />
          </div>
          <div className="flex gap-2 flex-col">
            <p className="text-[30px] pl-6 font-medium leading-[140%]">
              Вредные привычки и зависимости
            </p>
            <input
              className="ml-6 border-0 focus:border-0 focus:outline-none focus:ring-0"
              placeholder="Введите..."
            />
          </div>
          <div className="flex gap-2 flex-col">
            <p className="text-[30px] pl-6 font-medium leading-[140%]">
              Аллергологический анамнез
            </p>
            <input
              className="ml-6 border-0 focus:border-0 focus:outline-none focus:ring-0"
              placeholder="Введите..."
            />
          </div>
          <div className="flex gap-2 flex-col">
            <p className="text-[30px] pl-6 font-medium leading-[140%]">
              Витальные параметры
            </p>
            <input
              className="ml-6 border-0 focus:border-0 focus:outline-none focus:ring-0"
              placeholder="Введите..."
            />
          </div>
          <div className="flex gap-2 flex-col">
            <p className="text-[30px] pl-6 font-medium leading-[140%]">
              Объективные данные
            </p>
            <input
              className="ml-6 border-0 focus:border-0 focus:outline-none focus:ring-0"
              placeholder="Введите..."
            />
          </div>
          <div className="flex gap-2 flex-col">
            <p className="text-[30px] pl-6 font-medium leading-[140%]">
              Объективизированная оценка состояния
            </p>
            <input
              className="ml-6 border-0 focus:border-0 focus:outline-none focus:ring-0"
              placeholder="Введите..."
            />
          </div>
          <div className="flex gap-2 flex-col">
            <p className="text-[30px] pl-6 font-medium leading-[140%]">
              Заключение консультации
            </p>
            <input
              className="ml-6 border-0 focus:border-0 focus:outline-none focus:ring-0"
              placeholder="Введите..."
            />
          </div>
          <div className="flex gap-2 flex-col">
            <p className="text-[30px] pl-6 font-medium leading-[140%]">
              Диагнозы
            </p>
            <input
              className="ml-6 border-0 focus:border-0 focus:outline-none focus:ring-0"
              placeholder="Введите..."
            />
          </div>
          <div className="flex gap-2 flex-col">
            <p className="text-[30px] pl-6 font-medium leading-[140%]">
              Рекомендации
            </p>
            <input
              className="ml-6 border-0 focus:border-0 focus:outline-none focus:ring-0"
              placeholder="Введите..."
            />
          </div>
          <div className="flex gap-2 flex-col">
            <p className="text-[30px] pl-6 font-medium leading-[140%]">
              Назначения
            </p>
            <input
              className="ml-6 border-0 focus:border-0 focus:outline-none focus:ring-0"
              placeholder="Введите..."
            />
          </div>
        </div>
        <button className="hover:bg-[#9b44dd] text-white rounded-xl h-13 ml-6 cursor-pointer bg-[#9C50D8] xs:max-lg:mr-6">
          Сохранить
        </button>
      </main>
    </div>
  );
}
