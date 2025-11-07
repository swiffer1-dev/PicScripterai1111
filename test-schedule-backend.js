#!/usr/bin/env node

/**
 * Backend Sanity Tests for Pending Scheduling Feature
 * Tests POST /api/schedule, GET /api/calendar, and PATCH /api/schedule/:id/resolve
 */

const BASE_URL = "http://localhost:5000";

// Helper function to make API requests
async function apiRequest(method, path, body = null, token = null) {
  const headers = {
    "Content-Type": "application/json",
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const options = {
    method,
    headers,
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${BASE_URL}${path}`, options);
  const data = await response.json();
  
  return { status: response.status, data };
}

// Test runner
async function runTests() {
  console.log("\n🧪 BACKEND SANITY TESTS FOR PENDING SCHEDULING\n");
  console.log("=" .repeat(60));
  
  let token = null;
  let postId = null;
  let testsPassed = 0;
  let testsFailed = 0;
  
  try {
    // Step 1: Create test user and get token
    console.log("\n📝 Step 1: Creating test user...");
    const email = `test-${Date.now()}@example.com`;
    const password = "testpassword123";
    
    const signupResult = await apiRequest("POST", "/api/auth/signup", {
      email,
      password,
    });
    
    if ((signupResult.status === 200 || signupResult.status === 201) && signupResult.data.token) {
      token = signupResult.data.token;
      console.log("✅ User created successfully");
      console.log(`   Email: ${email}`);
      testsPassed++;
    } else {
      console.log("❌ Failed to create user");
      console.log(`   Response:`, signupResult);
      testsFailed++;
      return;
    }
    
    // Step 2: Test POST /api/schedule with no connections (should create pending post)
    console.log("\n📝 Step 2: Testing POST /api/schedule (no connections)...");
    const scheduledAt = new Date();
    scheduledAt.setHours(scheduledAt.getHours() + 1);
    
    const scheduleResult = await apiRequest("POST", "/api/schedule", {
      caption: "Test post for pending scheduling",
      scheduledAt: scheduledAt.toISOString(),
      platforms: [
        { provider: "instagram" },
        { provider: "pinterest" } // Missing boardId - should flag as issue
      ],
    }, token);
    
    console.log(`   Status: ${scheduleResult.status}`);
    console.log(`   Response:`, JSON.stringify(scheduleResult.data, null, 2));
    
    if (scheduleResult.status === 200 && scheduleResult.data.status === "scheduled_pending") {
      console.log("✅ POST /api/schedule works correctly");
      console.log(`   - Status: ${scheduleResult.data.status}`);
      console.log(`   - Platforms: ${scheduleResult.data.platforms?.join(", ")}`);
      console.log(`   - Has issues: ${scheduleResult.data.issues ? "Yes" : "No"}`);
      if (scheduleResult.data.issues) {
        console.log(`   - Issues:`, JSON.stringify(scheduleResult.data.issues, null, 2));
      }
      postId = scheduleResult.data.id;
      testsPassed++;
    } else {
      console.log("❌ POST /api/schedule failed");
      console.log(`   Expected status: scheduled_pending`);
      console.log(`   Got status: ${scheduleResult.data.status}`);
      testsFailed++;
    }
    
    // Step 3: Test GET /api/calendar
    console.log("\n📝 Step 3: Testing GET /api/calendar...");
    const month = scheduledAt.toISOString().substring(0, 7); // YYYY-MM format
    
    const calendarResult = await apiRequest("GET", `/api/calendar?month=${month}`, null, token);
    
    console.log(`   Status: ${calendarResult.status}`);
    console.log(`   Response:`, JSON.stringify(calendarResult.data, null, 2));
    
    if (calendarResult.status === 200 && Array.isArray(calendarResult.data)) {
      const foundPost = calendarResult.data.find(p => p.id === postId);
      if (foundPost) {
        console.log("✅ GET /api/calendar works correctly");
        console.log(`   - Found ${calendarResult.data.length} post(s) in ${month}`);
        console.log(`   - Post status: ${foundPost.status}`);
        console.log(`   - Scheduled at: ${foundPost.scheduledAt}`);
        testsPassed++;
      } else {
        console.log("❌ POST not found in calendar");
        testsFailed++;
      }
    } else {
      console.log("❌ GET /api/calendar failed");
      testsFailed++;
    }
    
    // Step 4: Test PATCH /api/schedule/:id/resolve
    console.log("\n📝 Step 4: Testing PATCH /api/schedule/:id/resolve...");
    
    const resolveResult = await apiRequest("PATCH", `/api/schedule/${postId}/resolve`, {
      platforms: [
        { provider: "instagram" },
        { provider: "twitter" }
      ],
    }, token);
    
    console.log(`   Status: ${resolveResult.status}`);
    console.log(`   Response:`, JSON.stringify(resolveResult.data, null, 2));
    
    // Note: Without actual connections, this should still return scheduled_pending
    // But the endpoint should process the request successfully
    if (resolveResult.status === 200) {
      console.log("✅ PATCH /api/schedule/:id/resolve works correctly");
      console.log(`   - Status: ${resolveResult.data.status}`);
      console.log(`   - Platforms: ${resolveResult.data.platforms?.join(", ")}`);
      if (resolveResult.data.status === "scheduled_pending") {
        console.log(`   - ℹ️  Still pending (no connections exist, which is expected)`);
      }
      if (resolveResult.data.issues) {
        console.log(`   - Issues:`, JSON.stringify(resolveResult.data.issues, null, 2));
      }
      testsPassed++;
    } else {
      console.log("❌ PATCH /api/schedule/:id/resolve failed");
      testsFailed++;
    }
    
    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("\n📊 TEST SUMMARY\n");
    console.log(`✅ Passed: ${testsPassed}`);
    console.log(`❌ Failed: ${testsFailed}`);
    console.log(`📝 Total:  ${testsPassed + testsFailed}`);
    
    if (testsFailed === 0) {
      console.log("\n🎉 All tests passed! Backend is working correctly.\n");
      process.exit(0);
    } else {
      console.log("\n⚠️  Some tests failed. Please review the output above.\n");
      process.exit(1);
    }
    
  } catch (error) {
    console.error("\n❌ FATAL ERROR:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runTests();
