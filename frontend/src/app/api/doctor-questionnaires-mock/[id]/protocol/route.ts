import { NextResponse } from 'next/server';
import type {
  ProtocolFcieldsMain,
  ProtocolStructuresFields,
  ProtocolsFields,
} from '@/api';
import { buildFieldValues } from '../../_mock/fields';
import {
  conflict,
  isMockEnabled,
  notFound,
  requireAuth,
  unauthorized,
  unprocessable,
} from '../../_mock/guard';
import { applyMockMode, currentMockMode } from '../../_mock/mode';
import { findQuestionnaire } from '../../_mock/seed';
import { getProtocolId, setProtocolId } from '../../_mock/store';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Прямо в backend, как у заглушки распознавания (speech-mock), а не через
// собственный `/api/main/*`: в контейнере за прокси адрес из запроса —
// публичный адрес сайта, и изнутри он может быть недоступен.
const API_MAIN_URL = process.env.API_MAIN_URL || 'http://localhost:8000';

/** Ошибку backend отдать клиенту как есть: код и тело. */
const relayError = async (upstream: Response) => {
  const detail = await upstream
    .json()
    .catch(() => ({ detail: 'Upstream error' }));
  return NextResponse.json(detail, { status: upstream.status });
};

/**
 * Создать протокол из анкеты.
 *
 * Протокол создаётся НАСТОЯЩИЙ — запросами в backend с токеном врача. Иначе
 * «Создать протокол» вёл бы на несуществующий протокол: экран протокола ходит
 * в настоящий backend. Текст анкеты раскладывается по полям выбранной
 * структуры так же, как на сервере (`_mock/fields.ts`). В базе остаются
 * настоящие протоколы.
 */
export async function POST(request: Request, { params }: RouteContext) {
  if (!isMockEnabled) return notFound();

  const authorization = requireAuth(request);
  if (!authorization) return unauthorized();

  const failure = await applyMockMode(currentMockMode());
  if (failure) return failure;

  const { id } = await params;
  const questionnaire = findQuestionnaire(id);
  if (!questionnaire) {
    return NextResponse.json(
      { detail: 'Questionnaire not found' },
      { status: 404 },
    );
  }

  if (getProtocolId(id)) {
    return conflict('Protocol already created from this questionnaire');
  }

  const body = (await request.json().catch(() => null)) as {
    protocol_structure_id?: unknown;
  } | null;
  const structureId = body?.protocol_structure_id;
  if (typeof structureId !== 'string' || !structureId) {
    return unprocessable('protocol_structure_id is required');
  }

  // Поля структуры и справочник кодов полей — чтобы разложить анкету.
  // Несуществующая структура даёт 404 «Protocol structure not found», как у
  // настоящего эндпоинта.
  const readUpstream = (path: string) =>
    fetch(`${API_MAIN_URL}${path}`, {
      headers: { Authorization: authorization },
      cache: 'no-store',
    });
  const [structureResponse, mainsResponse] = await Promise.all([
    readUpstream(`/protocol-structures/${encodeURIComponent(structureId)}`),
    readUpstream('/protocol-fields-main'),
  ]);
  if (!structureResponse.ok) return relayError(structureResponse);
  if (!mainsResponse.ok) return relayError(mainsResponse);

  const structure =
    (await structureResponse.json()) as ProtocolStructuresFields;
  const mains = (await mainsResponse.json()) as ProtocolFcieldsMain[];

  const upstream = await fetch(`${API_MAIN_URL}/protocols`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      protocol_structure_id: structureId,
      protocol_name: `Анкета ${questionnaire.patient_first_name ?? ''}`.trim(),
      field_values: buildFieldValues(
        questionnaire.structured,
        structure.fields,
        mains,
      ),
    }),
    cache: 'no-store',
  });

  if (!upstream.ok) return relayError(upstream);

  const protocol = (await upstream.json()) as ProtocolsFields;
  setProtocolId(id, protocol.id);

  return NextResponse.json(protocol, { status: 201 });
}
