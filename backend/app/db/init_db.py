from app.db.seed_data import seed_database


async def init_db_data():
    await seed_database()
