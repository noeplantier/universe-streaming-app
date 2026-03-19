#!/usr/bin/env python3
"""
UNIVERSE Backend API Testing
Comprehensive test suite for all backend endpoints
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://cinema-social-dev.preview.emergentagent.com/api"
TIMEOUT = 30

class UniverseAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.user_id = None
        self.test_results = []
        self.session = requests.Session()
        self.session.timeout = TIMEOUT

    def log_result(self, test_name: str, success: bool, details: str = "", status_code: int = 0):
        """Log test result"""
        result = {
            'test': test_name,
            'success': success,
            'details': details,
            'status_code': status_code
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if status_code:
            print(f"   Status: {status_code}")
        print()

    def make_request(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None) -> tuple[int, Dict]:
        """Make HTTP request and return status code and response"""
        url = f"{self.base_url}{endpoint}"
        default_headers = {'Content-Type': 'application/json'}
        
        if headers:
            default_headers.update(headers)
        
        if self.token and 'Authorization' not in default_headers:
            default_headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method.upper() == 'GET':
                response = self.session.get(url, headers=default_headers)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, headers=default_headers)
            elif method.upper() == 'DELETE':
                response = self.session.delete(url, headers=default_headers)
            else:
                return 0, {"error": f"Unsupported method: {method}"}
            
            try:
                return response.status_code, response.json()
            except json.JSONDecodeError:
                return response.status_code, {"raw_response": response.text}
                
        except requests.exceptions.RequestException as e:
            return 0, {"error": str(e)}

    def test_health_check(self):
        """Test 1: Health Check - GET /api/"""
        status_code, response = self.make_request('GET', '/')
        success = status_code == 200 and response.get('status') == 'ok'
        self.log_result(
            "Health Check (GET /api/)", 
            success,
            f"Response: {response}",
            status_code
        )
        return success

    def test_user_registration(self):
        """Test 2: User Registration - POST /api/auth/register"""
        user_data = {
            "username": "testuser_cinema",
            "email": "testuser@cinema.com", 
            "password": "securepass123"
        }
        
        status_code, response = self.make_request('POST', '/auth/register', user_data)
        success = status_code == 200 and 'token' in response and 'user' in response
        
        if success:
            self.token = response['token']
            self.user_id = response['user']['id']
        
        self.log_result(
            "User Registration (POST /api/auth/register)",
            success,
            f"Token received: {'Yes' if self.token else 'No'}, User ID: {self.user_id}",
            status_code
        )
        return success

    def test_user_login(self):
        """Test 3: User Login - POST /api/auth/login"""
        login_data = {
            "email": "testuser@cinema.com",
            "password": "securepass123"
        }
        
        status_code, response = self.make_request('POST', '/auth/login', login_data)
        success = status_code == 200 and 'token' in response and 'user' in response
        
        if success:
            self.token = response['token']
            self.user_id = response['user']['id']
        
        self.log_result(
            "User Login (POST /api/auth/login)",
            success,
            f"Login successful, token updated",
            status_code
        )
        return success

    def test_get_current_user(self):
        """Test 4: Get Current User - GET /api/auth/me"""
        if not self.token:
            self.log_result("Get Current User (GET /api/auth/me)", False, "No auth token available")
            return False
            
        status_code, response = self.make_request('GET', '/auth/me')
        success = status_code == 200 and 'id' in response
        
        self.log_result(
            "Get Current User (GET /api/auth/me)",
            success,
            f"User data received: {response.get('username', 'Unknown')}",
            status_code
        )
        return success

    def test_get_all_films(self):
        """Test 5: Get All Films - GET /api/films"""
        status_code, response = self.make_request('GET', '/films')
        success = status_code == 200 and isinstance(response, list) and len(response) > 0
        
        self.log_result(
            "Get All Films (GET /api/films)",
            success,
            f"Films count: {len(response) if isinstance(response, list) else 0}",
            status_code
        )
        return success

    def test_filter_films_by_duration(self):
        """Test 6: Filter Films by Duration - GET /api/films?duration_type=short"""
        status_code, response = self.make_request('GET', '/films?duration_type=short')
        success = status_code == 200 and isinstance(response, list)
        
        short_films_count = len([f for f in response if f.get('duration_type') == 'short']) if isinstance(response, list) else 0
        
        self.log_result(
            "Filter Films by Duration (GET /api/films?duration_type=short)",
            success,
            f"Short films found: {short_films_count}",
            status_code
        )
        return success

    def test_filter_films_by_genre(self):
        """Test 7: Filter Films by Genre - GET /api/films?genre=Thriller"""
        status_code, response = self.make_request('GET', '/films?genre=Thriller')
        success = status_code == 200 and isinstance(response, list)
        
        thriller_films_count = len([f for f in response if f.get('genre') == 'Thriller']) if isinstance(response, list) else 0
        
        self.log_result(
            "Filter Films by Genre (GET /api/films?genre=Thriller)",
            success,
            f"Thriller films found: {thriller_films_count}",
            status_code
        )
        return success

    def test_get_specific_film(self):
        """Test 8: Get Specific Film - GET /api/films/film1"""
        status_code, response = self.make_request('GET', '/films/film1')
        success = status_code == 200 and response.get('id') == 'film1'
        
        self.log_result(
            "Get Specific Film (GET /api/films/film1)",
            success,
            f"Film title: {response.get('title', 'Unknown')}",
            status_code
        )
        return success

    def test_get_feed(self):
        """Test 9: Get Feed for TikTok style - GET /api/feed"""
        status_code, response = self.make_request('GET', '/feed')
        success = status_code == 200 and isinstance(response, list)
        
        self.log_result(
            "Get Feed (GET /api/feed)",
            success,
            f"Feed items: {len(response) if isinstance(response, list) else 0}",
            status_code
        )
        return success

    def test_create_review(self):
        """Test 10: Create Review - POST /api/reviews"""
        if not self.token:
            self.log_result("Create Review", False, "No auth token available")
            return False
            
        review_data = {
            "film_id": "film1",
            "rating": 4.5,
            "content": "Incroyable thriller! La mise en scène est exceptionnelle et l'intrigue captivante."
        }
        
        status_code, response = self.make_request('POST', '/reviews', review_data)
        success = status_code == 200 and 'id' in response
        
        self.log_result(
            "Create Review (POST /api/reviews)",
            success,
            f"Review created with ID: {response.get('id', 'None')}",
            status_code
        )
        return success

    def test_get_reviews(self):
        """Test 11: Get Reviews - GET /api/reviews?film_id=film1"""
        status_code, response = self.make_request('GET', '/reviews?film_id=film1')
        success = status_code == 200 and isinstance(response, list)
        
        self.log_result(
            "Get Reviews (GET /api/reviews?film_id=film1)",
            success,
            f"Reviews found: {len(response) if isinstance(response, list) else 0}",
            status_code
        )
        return success

    def test_get_posts(self):
        """Test 12: Get Social Posts - GET /api/posts"""
        status_code, response = self.make_request('GET', '/posts')
        success = status_code == 200 and isinstance(response, list)
        
        self.log_result(
            "Get Social Posts (GET /api/posts)",
            success,
            f"Posts found: {len(response) if isinstance(response, list) else 0}",
            status_code
        )
        return success

    def test_create_post(self):
        """Test 13: Create Social Post - POST /api/posts"""
        if not self.token:
            self.log_result("Create Social Post", False, "No auth token available")
            return False
            
        post_data = {
            "content": "Je découvre des films incroyables sur cette plateforme! Le cinéma indépendant à son meilleur 🎬"
        }
        
        status_code, response = self.make_request('POST', '/posts', post_data)
        success = status_code == 200 and 'id' in response
        
        self.log_result(
            "Create Social Post (POST /api/posts)",
            success,
            f"Post created with ID: {response.get('id', 'None')}",
            status_code
        )
        return success

    def test_get_user_profile(self):
        """Test 14: Get User Profile - GET /api/users/user1"""
        status_code, response = self.make_request('GET', '/users/user1')
        success = status_code == 200 and response.get('id') == 'user1'
        
        self.log_result(
            "Get User Profile (GET /api/users/user1)",
            success,
            f"User: {response.get('username', 'Unknown')}",
            status_code
        )
        return success

    def test_follow_user(self):
        """Test 15: Follow User - POST /api/users/user2/follow"""
        if not self.token:
            self.log_result("Follow User", False, "No auth token available")
            return False
            
        status_code, response = self.make_request('POST', '/users/user2/follow')
        success = status_code == 200 and 'following' in response
        
        self.log_result(
            "Follow User (POST /api/users/user2/follow)",
            success,
            f"Following: {response.get('following', 'Unknown')}",
            status_code
        )
        return success

    def test_add_to_watchlist(self):
        """Test 16: Add to Watchlist - POST /api/watchlist"""
        if not self.token:
            self.log_result("Add to Watchlist", False, "No auth token available")
            return False
            
        watchlist_data = {
            "film_id": "film2"
        }
        
        status_code, response = self.make_request('POST', '/watchlist', watchlist_data)
        success = status_code == 200 and response.get('added') == True
        
        self.log_result(
            "Add to Watchlist (POST /api/watchlist)",
            success,
            f"Added to watchlist: {response.get('added', False)}",
            status_code
        )
        return success

    def test_get_watchlist(self):
        """Test 17: Get Watchlist - GET /api/watchlist"""
        if not self.user_id:
            self.log_result("Get Watchlist", False, "No user ID available")
            return False
            
        status_code, response = self.make_request('GET', f'/watchlist?user_id={self.user_id}')
        success = status_code == 200 and isinstance(response, list)
        
        self.log_result(
            "Get Watchlist (GET /api/watchlist)",
            success,
            f"Watchlist items: {len(response) if isinstance(response, list) else 0}",
            status_code
        )
        return success

    def test_remove_from_watchlist(self):
        """Test 18: Remove from Watchlist - DELETE /api/watchlist/film2"""
        if not self.token:
            self.log_result("Remove from Watchlist", False, "No auth token available")
            return False
            
        status_code, response = self.make_request('DELETE', '/watchlist/film2')
        success = status_code == 200 and response.get('removed') == True
        
        self.log_result(
            "Remove from Watchlist (DELETE /api/watchlist/film2)",
            success,
            f"Removed: {response.get('removed', False)}",
            status_code
        )
        return success

    def test_get_notifications(self):
        """Test 19: Get Notifications - GET /api/notifications"""
        if not self.token:
            self.log_result("Get Notifications", False, "No auth token available")
            return False
            
        status_code, response = self.make_request('GET', '/notifications')
        success = status_code == 200 and isinstance(response, list)
        
        self.log_result(
            "Get Notifications (GET /api/notifications)",
            success,
            f"Notifications: {len(response) if isinstance(response, list) else 0}",
            status_code
        )
        return success

    def test_get_trending(self):
        """Test 20: Get Trending Films - GET /api/trending"""
        status_code, response = self.make_request('GET', '/trending')
        success = status_code == 200 and isinstance(response, list)
        
        self.log_result(
            "Get Trending (GET /api/trending)",
            success,
            f"Trending films: {len(response) if isinstance(response, list) else 0}",
            status_code
        )
        return success

    def test_get_featured(self):
        """Test 21: Get Featured Film - GET /api/featured"""
        status_code, response = self.make_request('GET', '/featured')
        success = status_code == 200 and 'id' in response
        
        self.log_result(
            "Get Featured (GET /api/featured)",
            success,
            f"Featured film: {response.get('title', 'Unknown')}",
            status_code
        )
        return success

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting UNIVERSE Backend API Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        print()

        # Test sequence - order matters for auth-dependent tests
        tests = [
            self.test_health_check,
            self.test_user_registration,
            self.test_user_login,
            self.test_get_current_user,
            self.test_get_all_films,
            self.test_filter_films_by_duration,
            self.test_filter_films_by_genre,
            self.test_get_specific_film,
            self.test_get_feed,
            self.test_create_review,
            self.test_get_reviews,
            self.test_get_posts,
            self.test_create_post,
            self.test_get_user_profile,
            self.test_follow_user,
            self.test_add_to_watchlist,
            self.test_get_watchlist,
            self.test_remove_from_watchlist,
            self.test_get_notifications,
            self.test_get_trending,
            self.test_get_featured,
        ]

        for test in tests:
            try:
                test()
            except Exception as e:
                self.log_result(test.__name__, False, f"Exception: {str(e)}")

        # Summary
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in self.test_results if r['success'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        print()
        
        # Failed tests details
        failed_tests = [r for r in self.test_results if not r['success']]
        if failed_tests:
            print("❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']} (Status: {test['status_code']})")
        else:
            print("🎉 All tests passed!")
        
        return passed == total

if __name__ == "__main__":
    tester = UniverseAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)