'use client';

import { useState } from 'react';
import type {
  PublicLink,
  PublicLinkDoctor,
  QuestionnaireStep,
  QuestionnaireStepAnswer,
} from '@/api';
import { brandStyle } from '@/lib/branding';
import {
  buildAnswer,
  clinicBranding,
  screenForStep,
} from '@/lib/questionnaire';
import { useQuestionnaireFlow } from '@/hooks/useQuestionnaireFlow';
import { WelcomeScreen } from './WelcomeScreen';
import { ConsentScreen } from './ConsentScreen';
import { DoctorPicker } from './DoctorPicker';
import { DoctorList } from './DoctorList';
import { ChatStep } from './ChatStep';
import { PatientNameForm } from './PatientNameForm';
import { AppointmentTimeForm } from './AppointmentTimeForm';
import { CodeScreen } from './CodeScreen';
import { QuestionnaireStub } from './QuestionnaireStub';
import { QuestionnaireThemeProvider } from './QuestionnaireTheme';

interface QuestionnaireAppProps {
  /** Slug ссылки из адреса страницы. */
  slug: string;
  /** Данные ссылки. `null` — серверный запрос не удался. */
  link: PublicLink | null;
}

interface PatientInfoStepProps {
  step: QuestionnaireStep;
  submit: (
    answer: QuestionnaireStepAnswer,
  ) => Promise<QuestionnaireStep | null>;
  isSubmitting: boolean;
  submitError: string | null;
}

/**
 * Шаг `patient_info`: имя на одном экране, дата и время — на следующем,
 * а на сервер всё уходит одним ответом. Живёт отдельным компонентом с ключом
 * анкеты, чтобы имя от прежней анкеты не попало в новую.
 */
const PatientInfoStep = ({
  step,
  submit,
  isSubmitting,
  submitError,
}: PatientInfoStepProps) => {
  const [stage, setStage] = useState<'name' | 'appointment'>('name');
  const [name, setName] = useState({ firstName: '', middleName: '' });

  if (stage === 'name') {
    return (
      <PatientNameForm
        firstName={name.firstName}
        middleName={name.middleName}
        onSubmit={(data) => {
          setName(data);
          setStage('appointment');
        }}
      />
    );
  }

  return (
    <AppointmentTimeForm
      dateMin={step.date_min}
      dateMax={step.date_max}
      isSubmitting={isSubmitting}
      error={submitError}
      onSubmit={({ date, time }) => {
        void submit(
          buildAnswer(step, {
            type: 'patient_info',
            firstName: name.firstName,
            middleName: name.middleName,
            date,
            time,
          }),
        );
      }}
    />
  );
};

/**
 * Публичная анкета пациента.
 *
 * Экран выбирается по шагу сервера: сценарий ведёт backend. Порядок строгий —
 * начатая анкета важнее заглушки: backend даёт закончить её и после
 * блокировки ссылки, и после старта из заглушки неактивного врача.
 */
export const QuestionnaireApp = ({ slug, link }: QuestionnaireAppProps) => {
  const flow = useQuestionnaireFlow(slug, link);
  const clinic = clinicBranding(link);

  const [consentOpen, setConsentOpen] = useState(false);
  // Возврат из чата к выбору врача — экран поверх шага: прежняя анкета
  // активна, пока не выбран другой врач.
  const [pickingDoctor, setPickingDoctor] = useState(false);
  const [pendingDoctorId, setPendingDoctorId] = useState<string | null>(null);

  // Куда возвращаться из чата: врачи шага `choose_doctor`, а после
  // перезагрузки (шага выбора в этой вкладке не было) — врачи ссылки клиники.
  const backDoctors =
    flow.doctors.length > 0
      ? flow.doctors
      : link?.link_type === 'clinic'
        ? link.doctors
        : [];
  // При заблокированной ссылке (подписка, суточный лимит) новая анкета не
  // начнётся, а прежняя к тому моменту уже сброшена — возврат не предлагаем:
  // начатую анкету backend даёт закончить. При активном шаге `flow.block` —
  // это блокировка ссылки: блокировку старта сбрасывает успешный старт.
  const canGoBack = backDoctors.length > 0 && flow.block === null;

  const handleStart = () => {
    // Согласие по ТЗ выключено (допущение Д1); включит его сервер (ВЗ-7).
    if (link?.consent_required) {
      setConsentOpen(true);
      return;
    }

    void flow.start();
  };

  const handleConsentAccepted = () => {
    setConsentOpen(false);
    void flow.start();
  };

  const chooseDoctorOnStep = (
    step: QuestionnaireStep,
    membershipId: string,
  ) => {
    setPendingDoctorId(membershipId);
    void flow.submit(buildAnswer(step, { type: 'doctor', membershipId }));
  };

  const restartWithDoctor = (membershipId: string) => {
    setPendingDoctorId(membershipId);
    void flow.restartWithDoctor(membershipId).then((outcome) => {
      // Не удалось — остаёмся в списке с ошибкой и «Повторить». Заглушка
      // (лимит и т. п.) показывается уже без списка.
      if (outcome === 'started' || outcome === 'blocked') {
        setPickingDoctor(false);
      }
    });
  };

  const startWithDoctor = (membershipId: string) => {
    setPendingDoctorId(membershipId);
    void flow.start(membershipId);
  };

  const content = () => {
    if (pickingDoctor) {
      return (
        <DoctorPicker
          doctors={backDoctors}
          isSelecting={flow.isStarting}
          pendingId={pendingDoctorId}
          error={flow.startError}
          onRetry={
            pendingDoctorId
              ? () => restartWithDoctor(pendingDoctorId)
              : undefined
          }
          onSelect={(doctor: PublicLinkDoctor) =>
            restartWithDoctor(doctor.membership_id)
          }
        />
      );
    }

    const { step } = flow;
    if (step) {
      switch (screenForStep(step)) {
        case 'doctor':
          return (
            <DoctorPicker
              doctors={flow.doctors}
              isSelecting={flow.isSubmitting}
              pendingId={pendingDoctorId}
              error={flow.submitError}
              // Отказ «врач недоступен» обновляет список с сервера: повтор
              // имеет смысл, только если врач в нём остался.
              onRetry={
                pendingDoctorId &&
                flow.doctors.some(
                  (doctor) => doctor.membership_id === pendingDoctorId,
                )
                  ? () => chooseDoctorOnStep(step, pendingDoctorId)
                  : undefined
              }
              onSelect={(doctor) =>
                chooseDoctorOnStep(step, doctor.membership_id)
              }
            />
          );

        case 'chat':
          return (
            <ChatStep
              // Новая анкета — новая лента.
              key={flow.questionnaireId}
              step={step}
              submit={flow.submit}
              isSubmitting={flow.isSubmitting}
              submitError={flow.submitError}
              // Возврат — только когда есть список, куда возвращаться. Выбор
              // другого врача начнёт новую анкету, прежняя останется на
              // сервере брошенной: вернуться на шаг назад backend не умеет.
              onBack={canGoBack ? () => setPickingDoctor(true) : undefined}
            />
          );

        case 'patient_info':
          return (
            <PatientInfoStep
              key={flow.questionnaireId}
              step={step}
              submit={flow.submit}
              isSubmitting={flow.isSubmitting}
              submitError={flow.submitError}
            />
          );

        case 'code':
          return (
            <CodeScreen
              code={step.code ?? ''}
              aiUnavailable={step.ai_unavailable}
              onClose={flow.finish}
            />
          );
      }
    }

    if (flow.block) {
      const showDoctors = flow.block === 'doctor_inactive' && link !== null;

      return (
        <QuestionnaireStub state={flow.block} clinic={clinic}>
          {/* ТЗ: «Врач не ведёт приём, выберите другого» — и список врачей.
              Без него текст предлагает выбор, которого негде сделать. */}
          {showDoctors ? (
            <div className="flex flex-col gap-3">
              <DoctorList
                doctors={link.doctors}
                isSelecting={flow.isStarting}
                pendingId={pendingDoctorId}
                onSelect={(doctor) => startWithDoctor(doctor.membership_id)}
              />
              {flow.startError && !flow.isStarting ? (
                <p role="alert" className="text-sm text-[#C2334D]">
                  {flow.startError}
                </p>
              ) : null}
            </div>
          ) : null}
        </QuestionnaireStub>
      );
    }

    if (consentOpen) {
      return <ConsentScreen clinic={clinic} onAccept={handleConsentAccepted} />;
    }

    return (
      <WelcomeScreen
        clinic={clinic}
        isStarting={flow.isStarting || flow.isResuming}
        error={flow.startError}
        onStart={handleStart}
      />
    );
  };

  const theme = brandStyle(clinic);

  return (
    // Токены темы объявлены на этом контейнере, а не на :root: фирменные
    // цвета клиники не должны попадать на экраны Ассистента врача.
    <QuestionnaireThemeProvider value={theme}>
      <div data-questionnaire className="q-page" style={theme}>
        {/* На телефоне обёртка ничего не меняет, на широком экране становится
            карточкой по центру — правила только в медиазапросе от 768px. */}
        <div className="q-shell">{content()}</div>
      </div>
    </QuestionnaireThemeProvider>
  );
};
