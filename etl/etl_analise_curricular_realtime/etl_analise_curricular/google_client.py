from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
]
MIME_GOOGLE_SHEETS = "application/vnd.google-apps.spreadsheet"


@dataclass(frozen=True)
class ArquivoGoogle:
    id: str
    nome: str
    modified_time: datetime
    web_view_link: str | None
    parents: tuple[str, ...]


class GoogleClient:
    def __init__(self, credentials_file: str):
        credentials = Credentials.from_service_account_file(credentials_file, scopes=SCOPES)
        self.drive = build("drive", "v3", credentials=credentials, cache_discovery=False)
        self.sheets = build("sheets", "v4", credentials=credentials, cache_discovery=False)

    @staticmethod
    def _parse_datetime(valor: str) -> datetime:
        return datetime.fromisoformat(valor.replace("Z", "+00:00"))

    def listar_planilhas_pasta(self, folder_id: str) -> list[ArquivoGoogle]:
        consulta = (
            f"'{folder_id}' in parents and trashed = false and "
            f"mimeType = '{MIME_GOOGLE_SHEETS}'"
        )
        arquivos: list[ArquivoGoogle] = []
        page_token = None

        while True:
            resposta = (
                self.drive.files()
                .list(
                    q=consulta,
                    fields="nextPageToken, files(id,name,modifiedTime,webViewLink,parents)",
                    pageSize=1000,
                    pageToken=page_token,
                    supportsAllDrives=True,
                    includeItemsFromAllDrives=True,
                )
                .execute()
            )

            for item in resposta.get("files", []):
                arquivos.append(
                    ArquivoGoogle(
                        id=item["id"],
                        nome=item.get("name", ""),
                        modified_time=self._parse_datetime(item["modifiedTime"]),
                        web_view_link=item.get("webViewLink"),
                        parents=tuple(item.get("parents", [])),
                    )
                )

            page_token = resposta.get("nextPageToken")
            if not page_token:
                break

        arquivos.sort(key=lambda x: x.nome.casefold())
        return arquivos

    def obter_arquivo(self, file_id: str) -> ArquivoGoogle:
        item = (
            self.drive.files()
            .get(
                fileId=file_id,
                fields="id,name,modifiedTime,webViewLink,parents,mimeType,trashed",
                supportsAllDrives=True,
            )
            .execute()
        )

        if item.get("trashed"):
            raise RuntimeError("A planilha informada esta na lixeira.")
        if item.get("mimeType") != MIME_GOOGLE_SHEETS:
            raise RuntimeError("O arquivo informado nao e um Google Sheets.")

        return ArquivoGoogle(
            id=item["id"],
            nome=item.get("name", ""),
            modified_time=self._parse_datetime(item["modifiedTime"]),
            web_view_link=item.get("webViewLink"),
            parents=tuple(item.get("parents", [])),
        )

    def ler_aba(self, spreadsheet_id: str, sheet_name: str) -> list[list[Any]]:
        intervalo = f"'{sheet_name.replace("'", "''")}'!A:ZZ"
        try:
            resposta = (
                self.sheets.spreadsheets()
                .values()
                .get(
                    spreadsheetId=spreadsheet_id,
                    range=intervalo,
                    valueRenderOption="FORMATTED_VALUE",
                    dateTimeRenderOption="FORMATTED_STRING",
                )
                .execute()
            )
        except HttpError as exc:
            if exc.resp.status == 400:
                raise RuntimeError(f'Aba obrigatoria "{sheet_name}" nao encontrada.') from exc
            raise

        return resposta.get("values", [])
