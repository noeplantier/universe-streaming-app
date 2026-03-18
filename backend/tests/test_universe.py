"""UNIVERSE API Tests - Films, Posts, Reviews, Auth, Social"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

@pytest.fixture
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s

@pytest.fixture
def auth_headers(session):
    resp = session.post(f"{BASE_URL}/api/auth/login", json={"email": "demo@universe.com", "password": "demo123"})
    if resp.status_code != 200:
        pytest.skip("Login failed")
    token = resp.json()["token"]
    return {"Authorization": f"Bearer {token}"}

# Health
class TestHealth:
    def test_api_root(self, session):
        resp = session.get(f"{BASE_URL}/api/")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

# Auth
class TestAuth:
    def test_login_demo(self, session):
        resp = session.post(f"{BASE_URL}/api/auth/login", json={"email": "demo@universe.com", "password": "demo123"})
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == "demo@universe.com"

    def test_login_wrong_password(self, session):
        resp = session.post(f"{BASE_URL}/api/auth/login", json={"email": "demo@universe.com", "password": "wrong"})
        assert resp.status_code == 401

    def test_get_me(self, session, auth_headers):
        resp = session.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        assert "email" in resp.json()
        assert "password_hash" not in resp.json()

    def test_register_new_user(self, session):
        import uuid
        uid = str(uuid.uuid4())[:8]
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "username": f"TEST_{uid}",
            "email": f"test_{uid}@universe.com",
            "password": "testpass123"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert "user" in data

# Films
class TestFilms:
    def test_get_all_films(self, session):
        resp = session.get(f"{BASE_URL}/api/films")
        assert resp.status_code == 200
        films = resp.json()
        assert len(films) >= 10, f"Expected 10 films, got {len(films)}"

    def test_films_have_duration_types(self, session):
        resp = session.get(f"{BASE_URL}/api/films")
        assert resp.status_code == 200
        films = resp.json()
        types = {f["duration_type"] for f in films}
        assert "short" in types
        assert "medium" in types
        assert "long" in types

    def test_film_detail(self, session):
        resp = session.get(f"{BASE_URL}/api/films/film1")
        assert resp.status_code == 200
        film = resp.json()
        assert film["id"] == "film1"
        assert "title" in film
        assert "synopsis" in film
        assert "poster_url" in film

    def test_film_filter_by_genre(self, session):
        resp = session.get(f"{BASE_URL}/api/films?genre=Thriller")
        assert resp.status_code == 200
        films = resp.json()
        assert all(f["genre"] == "Thriller" for f in films)

    def test_film_search(self, session):
        resp = session.get(f"{BASE_URL}/api/films?q=minuit")
        assert resp.status_code == 200
        films = resp.json()
        assert len(films) >= 1

    def test_film_not_found(self, session):
        resp = session.get(f"{BASE_URL}/api/films/nonexistent_id")
        assert resp.status_code == 404

    def test_feed_endpoint(self, session):
        resp = session.get(f"{BASE_URL}/api/feed")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

# Reviews
class TestReviews:
    def test_get_reviews(self, session):
        resp = session.get(f"{BASE_URL}/api/reviews")
        assert resp.status_code == 200
        reviews = resp.json()
        assert len(reviews) >= 5
        for r in reviews:
            assert "user" in r
            assert "film" in r

    def test_get_reviews_for_film(self, session):
        resp = session.get(f"{BASE_URL}/api/reviews?film_id=film1")
        assert resp.status_code == 200
        reviews = resp.json()
        assert all(r["film_id"] == "film1" for r in reviews)

    def test_create_review(self, session, auth_headers):
        resp = session.post(f"{BASE_URL}/api/reviews", json={
            "film_id": "film2",
            "content": "TEST_ Great film for testing purposes",
            "rating": 4.0
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["film_id"] == "film2"
        assert data["rating"] == 4.0

    def test_create_review_unauthenticated(self, session):
        resp = session.post(f"{BASE_URL}/api/reviews", json={
            "film_id": "film1", "content": "test", "rating": 3.0
        })
        assert resp.status_code == 401

# Posts
class TestPosts:
    def test_get_posts(self, session):
        resp = session.get(f"{BASE_URL}/api/posts")
        assert resp.status_code == 200
        posts = resp.json()
        assert len(posts) >= 5
        for p in posts:
            assert "user" in p

    def test_create_post(self, session, auth_headers):
        resp = session.post(f"{BASE_URL}/api/posts", json={
            "content": "TEST_ post for universe testing"
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        assert data["content"] == "TEST_ post for universe testing"

    def test_like_post(self, session, auth_headers):
        resp = session.post(f"{BASE_URL}/api/posts/post1/like", headers=auth_headers)
        assert resp.status_code == 200
        assert "liked" in resp.json()

# Films Seen
class TestFilmsSeen:
    def test_mark_film_seen(self, session, auth_headers):
        resp = session.post(f"{BASE_URL}/api/films-seen", json={"film_id": "film5"}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["seen"] == True

    def test_get_films_seen(self, session):
        resp = session.get(f"{BASE_URL}/api/films-seen?user_id=user1")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
