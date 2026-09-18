document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("loginForm");
  if (!form) return;

  const notification = document.getElementById("loginNotification");
  const submitBtn = document.getElementById("loginSubmitBtn");

  function showNotification(message, type) {
    notification.textContent = message;
    notification.className = `alert alert-${type}`;
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in…";

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: document.getElementById("username").value,
          password: document.getElementById("password").value
        })
      });
      const data = await response.json();

      if (!response.ok) {
        showNotification(data.error || "Login failed.", "danger");
        return;
      }

      showNotification("Login successful — redirecting to the admin dashboard…", "success");
      window.location.href = "/admin";
    } catch (err) {
      console.error(err);
      showNotification("Could not reach the server. Please try again.", "danger");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Log in";
    }
  });
});
