"""Локальный UI-стенд с синтетическими данными и настоящей чистой машиной gastro.

Не заменяет интеграционный тест PostgreSQL. Не подключается к рабочей БД или ML.
Запуск: Python backend-окружения scripts/qa/gastro_fixture.py. Только 127.0.0.1:8017.
"""
from __future__ import annotations

import sys
from dataclasses import asdict
from datetime import date, timedelta
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from fastapi import FastAPI, HTTPException, Request
from app.services.gastro.flow import GastroAnswerError, answer, descriptor
from app.services.gastro.summary import build_summary
from app.services.questionnaire_step import StepDescriptor

app = FastAPI(title="Synthetic gastro UI fixture")
sessions: dict[str, dict] = {}
doctor = {"membership_id":"b2d5c6ae-8976-43c3-9ca5-e3b7b46da49d", "public_slug":"gastro-demo",
          "photo_url":None,"first_name":"Демо","last_name":"Гастроэнтеролог","middle_name":None,
          "specializations":[{"id":42,"code":"gastro","name":"Гастроэнтеролог"}]}


def response(session: dict) -> dict:
    step = session["step"]
    if step == "visit_type":
        return asdict(StepDescriptor(step_key=step,step_type="choice",title="Тип приёма",
            choices=[{"value":"primary","label":"Первичный"},{"value":"repeat","label":"Повторный"}]))
    if step == "code":
        return asdict(StepDescriptor(step_key="code",step_type="code",title="Ответы сохранены",completed=True,code=session["code"]))
    result = descriptor(step,session["state"])
    result.date_min = date.today().isoformat()
    result.date_max = (date.today()+timedelta(days=30)).isoformat()
    return asdict(result)


@app.get("/public/links/{slug}")
def link(slug: str):
    return {"link_type":"doctor","clinic_id":"5883bbf3-5a67-47aa-a7c8-0110cfba529a",
        "clinic_name":"Проверка гастроанкеты — синтетические данные","phone":None,"logo_url":None,
        "brand_color":"#315F93","clinic_public_slug":"gastro-demo","doctor":doctor,"doctors":[doctor],
        "blocked":False,"block_code":None,"block_message":None}


@app.post("/public/questionnaires")
def start():
    identifier = str(uuid4())
    sessions[identifier] = {"state":{},"step":"visit_type","token":str(uuid4())}
    return {"id":identifier,"token":sessions[identifier]["token"],"step":response(sessions[identifier])}


def load(identifier: str, request: Request) -> dict:
    session = sessions.get(identifier)
    if not session or request.headers.get("X-Questionnaire-Token") != session["token"]:
        raise HTTPException(401,"Invalid fixture session")
    return session


@app.get("/public/questionnaires/{identifier}/step")
def get_step(identifier: str, request: Request):
    return response(load(identifier,request))


@app.post("/public/questionnaires/{identifier}/answer")
async def submit(identifier: str, request: Request):
    session = load(identifier,request)
    payload = await request.json()
    if session["step"] == "code":
        return response(session)
    if payload.get("step_key") != session["step"]:
        raise HTTPException(409,"Stale fixture step")
    if session["step"] == "visit_type":
        session["step"] = "gastro_reason"
    else:
        try:
            session["state"],session["step"] = answer(session["state"],session["step"],
                revision=payload.get("revision"),selections=payload.get("selections") or {},
                texts=payload.get("texts") or {},choice=payload.get("choice"))
        except GastroAnswerError as exc:
            raise HTTPException(400,str(exc)) from exc
        if session["step"] == "code":
            session["code"] = f"{len(sessions):04d}"
            session["structured"],session["gaps"] = build_summary(session["state"])
    return response(session)


@app.get("/qa/sessions")
def inspect_fixture():
    return list(sessions.values())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app,host="127.0.0.1",port=8017,access_log=False)
