'use client';

import { useCallback, useState } from 'react';
import type { QuestionnaireDoctor, QuestionnaireLink } from '@/api';
import { brandStyle } from '@/lib/branding';
import { isTerminalState, needsDoctorList } from '@/lib/questionnaire';
import { useQuestionnaireSession } from '@/hooks/useQuestionnaireSession';
import { WelcomeScreen } from './WelcomeScreen';
import { ConsentScreen } from './ConsentScreen';
import { DoctorPicker } from './DoctorPicker';
import { DoctorList } from './DoctorList';
import { ChatStep } from './ChatStep';
import { PatientNameForm } from './PatientNameForm';
import { AppointmentTimeForm } from './AppointmentTimeForm';
import { CodeScreen } from './CodeScreen';
import { QuestionnaireStub } from './QuestionnaireStub';

interface QuestionnaireAppProps {
  linkCode: string;
  /** Данные ссылки. `null` — серверный запрос не удался. */
  link: QuestionnaireLink | null;
}

type Step =
  | 'welcome'
  | 'consent'
  | 'doctor'
  | 'chat'
  | 'name'
  | 'appointment'
  | 'code'
  | 'stub';

/**
 * Публичная анкета пациента.
 *
 * Шаги — состояние одной страницы, а не отдельные адреса: ТЗ (допущение Д8)
 * разрешает потерять прогресс при закрытии браузера, но кнопка «назад» не
 * должна ронять уже начатый диалог с ассистентом.
 */
export const QuestionnaireApp = ({ linkCode, link }: QuestionnaireAppProps) => {
  const [step, setStep] = useState<Step>(() => {
    if (!link) return 'welcome';
    return isTerminalState(link.state) ? 'stub' : 'welcome';
  });
  const [doctor, setDoctor] = useState<QuestionnaireDoctor | null>(
    link?.doctor ?? null,
  );
  const [aiUnavailable, setAiUnavailable] = useState(false);
  // Имя собирается на одном шаге, дата и время — на следующем, поэтому
  // держим его здесь до отправки обоих экранов одним запросом.
  const [name, setName] = useState({ firstName: '', middleName: '' });

  const doctorInactive = link?.state === 'doctor_inactive';
  // Правило вынесено в src/lib и покрыто тестами: от него зависит, уйдёт ли
  // лишний публичный запрос, расходующий лимиты обращений из ТЗ.
  const session = useQuestionnaireSession(
    linkCode,
    needsDoctorList(link, step === 'doctor'),
  );

  const startWithDoctor = useCallback(
    async (selected: QuestionnaireDoctor) => {
      setDoctor(selected);
      const started = await session.start(selected.id);
      if (started) setStep('chat');
    },
    [session],
  );

  const handleWelcomeNext = useCallback(() => {
    if (link?.consent_required) {
      setStep('consent');
      return;
    }

    // По ссылке врача экран выбора пропускается — анкета начинается сразу.
    if (doctor) {
      void startWithDoctor(doctor);
      return;
    }

    setStep('doctor');
  }, [link?.consent_required, doctor, startWithDoctor]);

  const handleConsentAccepted = useCallback(() => {
    if (doctor) {
      void startWithDoctor(doctor);
      return;
    }

    setStep('doctor');
  }, [doctor, startWithDoctor]);

  const handleChatFinished = useCallback((unavailable: boolean) => {
    setAiUnavailable(unavailable);
    setStep('name');
  }, []);

  const handleBackToDoctors = useCallback(() => {
    setStep('doctor');
  }, []);

  const content = () => {
    if (step === 'stub' && link) {
      return (
        <QuestionnaireStub state={link.state} clinic={link.clinic}>
          {/* ТЗ: «Врач не ведёт приём, выберите другого» — и список врачей.
              Без него текст предлагает выбор, которого негде сделать. */}
          {doctorInactive ? (
            <DoctorList
              doctors={session.doctors}
              isLoading={session.isLoadingDoctors}
              error={session.doctorsError}
              isStarting={session.isStarting}
              onReload={session.reloadDoctors}
              onSelect={(selected) => void startWithDoctor(selected)}
            />
          ) : null}
        </QuestionnaireStub>
      );
    }

    // Брендинг не загрузился: анкета всё равно работает, просто в
    // нейтральной теме и без названия клиники на приветствии.
    const clinic = link?.clinic ?? {
      name: 'Клиника',
      phone: '',
      logo_url: null,
      brand_color: null,
    };

    switch (step) {
      case 'welcome':
        return (
          <WelcomeScreen
            clinic={clinic}
            isStarting={session.isStarting}
            error={session.startError}
            onStart={handleWelcomeNext}
          />
        );

      case 'consent':
        return (
          <ConsentScreen clinic={clinic} onAccept={handleConsentAccepted} />
        );

      case 'doctor':
        return (
          <DoctorPicker
            doctors={session.doctors}
            specializations={session.specializations}
            isLoading={session.isLoadingDoctors}
            error={session.doctorsError}
            isStarting={session.isStarting}
            startError={session.startError}
            onReload={session.reloadDoctors}
            onSelect={(selected) => void startWithDoctor(selected)}
          />
        );

      case 'chat':
        return session.session ? (
          <ChatStep
            sessionId={session.session.sessionId}
            initialMessage={session.session.firstMessage}
            onFinished={handleChatFinished}
            // Возврат предлагается только там, где есть куда вернуться —
            // по ссылке клиники. Выбор другого врача начнёт новый диалог,
            // а прежняя сессия останется на сервере брошенной: это
            // предусмотренное ТЗ состояние, а не потеря данных.
            onBack={link?.target === 'clinic' ? handleBackToDoctors : undefined}
          />
        ) : null;

      case 'name':
        return (
          <PatientNameForm
            firstName={name.firstName}
            middleName={name.middleName}
            onSubmit={(data) => {
              setName(data);
              setStep('appointment');
            }}
          />
        );

      case 'appointment':
        return (
          <AppointmentTimeForm
            isSubmitting={session.isCompleting}
            error={session.completeError}
            onSubmit={({ date, time }) => {
              void session
                .complete({
                  first_name: name.firstName,
                  middle_name: name.middleName,
                  appointment_date: date,
                  appointment_time: time,
                })
                .then((issued) => {
                  if (issued) setStep('code');
                });
            }}
          />
        );

      case 'code':
        return session.code ? (
          <CodeScreen code={session.code} aiUnavailable={aiUnavailable} />
        ) : null;

      default:
        return null;
    }
  };

  return (
    // Токены темы объявлены на этом контейнере, а не на :root: фирменные
    // цвета клиники не должны попадать на экраны Ассистента врача.
    <div data-questionnaire className="q-page" style={brandStyle(link?.clinic)}>
      {/* На телефоне обёртка ничего не меняет, на широком экране становится
          карточкой по центру — правила только в медиазапросе от 768px. */}
      <div className="q-shell">{content()}</div>
    </div>
  );
};
