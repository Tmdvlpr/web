import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN: str = os.environ["BOT_TOKEN"]
GROUP_ID: int = int(os.environ["GROUP_ID"])

DB_HOST: str = os.environ["DB_HOST"]
DB_PORT: int = int(os.environ["DB_PORT"])
DB_NAME: str = os.environ["DB_NAME"]
DB_USER: str = os.environ["DB_USER"]
DB_PASSWORD: str = os.environ["DB_PASSWORD"]

TIMEZONE = "Asia/Tashkent"

WORKING_HOURS_START = 9   # 09:00
WORKING_HOURS_END   = 19  # 19:00
MIN_SLOT_MINUTES    = 30

WEBAPP_PORT: int = int(os.environ.get("WEBAPP_PORT", "8080"))
WEBAPP_URL: str = os.environ.get("WEBAPP_URL", f"http://localhost:{WEBAPP_PORT}/webapp/")

BACKEND_URL: str = os.environ.get("BACKEND_URL", "http://localhost:8001")
BOT_SECRET: str = os.environ.get("BOT_SECRET", "")
