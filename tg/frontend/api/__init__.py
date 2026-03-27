from aiohttp import web

from .auth import auth_middleware
from .routes import (
    register, search_users,
    get_slots, get_bookings, create_booking, get_my_bookings,
    extend_booking_handler, cancel_booking,
    get_guest_bookings, decline_booking,
)


def setup_api_routes(app: web.Application):
    app.middlewares.append(auth_middleware)
    app.router.add_post("/api/register", register)
    app.router.add_get("/api/users", search_users)
    app.router.add_get("/api/slots", get_slots)
    app.router.add_get("/api/bookings", get_bookings)
    app.router.add_post("/api/bookings", create_booking)
    app.router.add_get("/api/my-bookings", get_my_bookings)
    app.router.add_patch("/api/bookings/{id}/extend", extend_booking_handler)
    app.router.add_delete("/api/bookings/{id}", cancel_booking)
    app.router.add_get("/api/guest-bookings", get_guest_bookings)
    app.router.add_post("/api/bookings/{id}/decline", decline_booking)
