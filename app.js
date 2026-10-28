(function () {
  "use strict";

  var C = window.EVENT_CONFIG;
  var DEMO = !C.appsScriptUrl;
  var ACT = {};
  C.activities.forEach(function (a) { ACT[a.id] = a; });
  var GROUP = {};
  C.ageGroups.forEach(function (g) { GROUP[g.id] = g; });

  var uid = 0;
  var state = {
    contact: { familyId: "", phone: "", email: "" },
    players: [],
    teams: []
  };
  var pendingOrder = null;
  var busy = false;

  /* ---------- helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function rupees(n) { return "₹" + Number(n).toLocaleString("en-IN"); }
  function feeOf(a) { return a.type === "team" ? a.fee : (a.fee || C.individualFee); }

  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  }
  function ageOn(dob) {
    var b = parseDate(dob), r = parseDate(C.ageReferenceDate);
    if (!b || !r) return null;
    var age = r.y - b.y;
    if (r.m < b.m || (r.m === b.m && r.d < b.d)) age--;
    return age;
  }
  function groupForAge(age) {
    if (age == null) return null;
    for (var i = 0; i < C.ageGroups.length; i++) {
      var g = C.ageGroups[i];
      if (age >= g.min && age <= g.max) return g;
    }
    return null;
  }
  function playerGroup(p) { return groupForAge(ageOn(p.dob)); }
  function eligibleGames(g, includeTeam) {
    return C.activities.filter(function (a) {
      return a.groups.indexOf(g.id) !== -1 && (includeTeam || a.type !== "team");
    });
  }
  function formatRefDate() {
    var r = parseDate(C.ageReferenceDate);
    var months = ["January", "February", "March", "April", "May", "June", "July",
      "August", "September", "October", "November", "December"];
    return r ? r.d + " " + months[r.m - 1] + " " + r.y : C.ageReferenceDate;
  }
  function cleanPhone(s) {
    var d = String(s || "").replace(/\D/g, "");
    if (d.length === 12 && d.indexOf("91") === 0) d = d.slice(2);
    if (d.length === 11 && d.charAt(0) === "0") d = d.slice(1);
    return d;
  }
  function isClosed() {
    return C.registrationDeadline && Date.now() > new Date(C.registrationDeadline).getTime();
  }

  /* ---------- static content ---------- */
  function renderStatic() {
    document.title = "Register | " + C.eventName;
    $("#eventName").textContent = C.eventName;
    $("#orgName").textContent = C.organiserName || "";
    $("#tagline").textContent = C.tagline || "";
    $("#eventDates").textContent = C.dates;
    $("#refDate").textContent = formatRefDate();
    $("#footContact").textContent = C.eventName + ". Questions? " + C.organiserContact;
    $("#demoNotice").hidden = !DEMO;

    $("#teamFees").innerHTML = C.activities.filter(function (a) { return a.type === "team"; })
      .map(function (a) {
        return "<li><span>" + esc(a.name) + "</span><span>" + rupees(a.fee) + " per team</span></li>";
      }).join("");

    if (isClosed()) {
      $("#closedNotice").hidden = false;
      $("#regForm").hidden = true;
      $("#totalbar").hidden = true;
    }
  }

  /* ---------- players ---------- */
  function newPlayer() {
    return { id: ++uid, name: "", gender: "", dob: "", games: {} };
  }

  function gamesHtml(p) {
    if (!p.dob) {
      return '<p class="games-hint">Enter the date of birth to see the games this player can enter.</p>';
    }
    var age = ageOn(p.dob);
    var g = groupForAge(age);
    if (!g) {
      var msg = age != null && age < C.ageGroups[0].min
        ? "This player will be " + age + " on " + formatRefDate() + ". The youngest age group starts at " + C.ageGroups[0].min + "."
        : "Check the date of birth. It doesn't fall in any age group.";
      return '<p class="games-hint games-hint-warn">' + esc(msg) + "</p>";
    }
    var list = eligibleGames(g, false).map(function (a) {
      var on = !!p.games[a.id];
      var partner = a.type === "pair" && on
        ? '<label class="partner"><span>Partner\'s name</span><input data-partner="' + a.id + '" value="' + esc(p.games[a.id].partner) + '" maxlength="80"></label>'
        : "";
      return '<div class="game' + (on ? " is-on" : "") + '">' +
        '<label class="game-pick"><input type="checkbox" data-game="' + a.id + '"' + (on ? " checked" : "") + ">" +
        '<span class="game-name">' + esc(a.name) + (a.type === "pair" ? ' <em>pair</em>' : "") + "</span>" +
        '<span class="game-fee">' + rupees(feeOf(a)) + "</span></label>" + partner + "</div>";
    }).join("");
    var teams = eligibleGames(g, true).filter(function (a) { return a.type === "team"; });
    var teamNote = teams.length
      ? '<p class="games-hint">Team games for ages ' + esc(g.label) + ": " +
        esc(teams.map(function (a) { return a.name; }).join(", ")) + ". Add these in step 3.</p>"
      : "";
    return '<p class="games-age">Age ' + age + " on " + formatRefDate() + ", plays in the " + esc(g.label) + " group</p>" +
      '<div class="game-list">' + list + "</div>" + teamNote;
  }

  function bibHtml(p, idx) {
    var g = playerGroup(p);
    return '<span class="bib-no">' + (idx + 1) + '</span><span class="bib-group">' +
      (g ? esc(g.label) : "Age group") + "</span>";
  }

  function playerHtml(p, idx) {
    var g = playerGroup(p);
    return '<article class="card player" data-pid="' + p.id + '" style="--g:' + (g ? g.color : "#8A94A6") + '">' +
      '<div class="bib">' + bibHtml(p, idx) + "</div>" +
      '<div class="card-body">' +
      '<div class="grid">' +
      '<label class="field field-wide"><span>Player\'s full name</span><input data-pf="name" value="' + esc(p.name) + '" maxlength="80"></label>' +
      '<label class="field"><span>Gender</span><select data-pf="gender">' +
      ["", "Female", "Male", "Other"].map(function (o) {
        return '<option value="' + o + '"' + (p.gender === o ? " selected" : "") + ">" + (o || "Choose") + "</option>";
      }).join("") + "</select></label>" +
      '<label class="field"><span>Date of birth</span><input type="date" data-pf="dob" value="' + esc(p.dob) + '" max="' + C.ageReferenceDate + '" min="1900-01-01"></label>' +
      "</div>" +
      '<div class="games">' + gamesHtml(p) + "</div>" +
      "</div>" +
      (state.players.length > 1 ? '<button type="button" class="btn-remove" data-action="remove-player" aria-label="Remove player ' + (idx + 1) + '">Remove</button>' : "") +
      "</article>";
  }

  function renderPlayers() {
    $("#players").innerHTML = state.players.map(playerHtml).join("");
  }

  function refreshPlayerGames(p) {
    var card = $('[data-pid="' + p.id + '"]');
    var g = playerGroup(p);
    // drop games the new age group can't play
    Object.keys(p.games).forEach(function (id) {
      if (!g || ACT[id].groups.indexOf(g.id) === -1) delete p.games[id];
    });
    card.style.setProperty("--g", g ? g.color : "#8A94A6");
    card.querySelector(".bib").innerHTML = bibHtml(p, state.players.indexOf(p));
    card.querySelector(".games").innerHTML = gamesHtml(p);
  }

  /* ---------- teams ---------- */
  function newTeam() {
    return { id: ++uid, activityId: "", groupId: "", teamName: "", members: [{ name: "", dob: "" }, { name: "", dob: "" }], womenConfirm: false };
  }

  function membersHtml(t) {
    return t.members.map(function (m, i) {
      return '<div class="member" data-mi="' + i + '">' +
        '<span class="member-no">' + (i + 1) + "</span>" +
        '<label class="field"><span>Name</span><input data-mf="name" value="' + esc(m.name) + '" maxlength="80"></label>' +
        '<label class="field field-mdob"><span>Date of birth</span><input data-mf="dob" type="date" value="' + esc(m.dob) + '" max="' + C.ageReferenceDate + '" min="1900-01-01"></label>' +
        (t.members.length > 1 ? '<button type="button" class="btn-x" data-action="remove-member" aria-label="Remove member ' + (i + 1) + '">×</button>' : "") +
        "</div>";
    }).join("");
  }

  function teamHtml(t, idx) {
    var a = ACT[t.activityId];
    var g = GROUP[t.groupId];
    var teamActs = C.activities.filter(function (x) { return x.type === "team"; });
    var groupOpts = a ? a.groups.map(function (gid) { return GROUP[gid]; }) : [];
    return '<article class="card team" data-tid="' + t.id + '" style="--g:' + (g ? g.color : "#8A94A6") + '">' +
      '<div class="bib bib-team"><span class="bib-no">T' + (idx + 1) + '</span><span class="bib-group">' + (g ? esc(g.label) : "Team") + "</span></div>" +
      '<div class="card-body"><div class="grid">' +
      '<label class="field"><span>Game</span><select data-tf="activityId"><option value="">Choose a game</option>' +
      teamActs.map(function (x) {
        return '<option value="' + x.id + '"' + (x.id === t.activityId ? " selected" : "") + ">" + esc(x.name) + " (" + rupees(x.fee) + ")</option>";
      }).join("") + "</select></label>" +
      '<label class="field"><span>Age group</span><select data-tf="groupId"' + (a ? "" : " disabled") + '><option value="">' + (a ? "Choose" : "Pick a game first") + "</option>" +
      groupOpts.map(function (x) {
        return '<option value="' + x.id + '"' + (x.id === t.groupId ? " selected" : "") + ">" + esc(x.label) + "</option>";
      }).join("") + "</select></label>" +
      '<label class="field field-wide"><span>Team name</span><input data-tf="teamName" value="' + esc(t.teamName) + '" maxlength="60"></label>' +
      "</div>" +
      '<p class="members-title">Team members' + (a ? " (at least " + a.teamMin + ")" : "") + "</p>" +
      '<div class="members">' + membersHtml(t) + "</div>" +
      '<button type="button" class="btn-small" data-action="add-member">Add member</button>' +
      (a && a.womenOnly
        ? '<label class="agree agree-small"><input type="checkbox" data-tf="womenConfirm"' + (t.womenConfirm ? " checked" : "") + "><span>All members of this team are women.</span></label>"
        : "") +
      "</div>" +
      '<button type="button" class="btn-remove" data-action="remove-team" aria-label="Remove team ' + (idx + 1) + '">Remove</button>' +
      "</article>";
  }

  function renderTeams() {
    $("#teams").innerHTML = state.teams.map(teamHtml).join("");
  }

  /* ---------- totals & summary ---------- */
  function computeTotal() {
    var total = 0;
    state.players.forEach(function (p) {
      Object.keys(p.games).forEach(function (id) { total += feeOf(ACT[id]); });
    });
    state.teams.forEach(function (t) { if (ACT[t.activityId]) total += ACT[t.activityId].fee; });
    return total;
  }

  function renderSummary() {
    var rows = [];
    state.players.forEach(function (p, i) {
      var ids = Object.keys(p.games);
      if (!ids.length) return;
      var sum = ids.reduce(function (s, id) { return s + feeOf(ACT[id]); }, 0);
      rows.push('<li><div><strong>' + esc(p.name || "Player " + (i + 1)) + "</strong><span>" +
        esc(ids.map(function (id) { return ACT[id].name; }).join(", ")) + "</span></div><b>" + rupees(sum) + "</b></li>");
    });
    state.teams.forEach(function (t, i) {
      var a = ACT[t.activityId];
      if (!a) return;
      var g = GROUP[t.groupId];
      rows.push('<li><div><strong>' + esc(t.teamName || "Team " + (i + 1)) + "</strong><span>" +
        esc(a.name) + (g ? ", ages " + esc(g.label) : "") + ", " + t.members.length + " members</span></div><b>" + rupees(a.fee) + "</b></li>");
    });
    var total = computeTotal();
    $("#summary").innerHTML = rows.length
      ? '<ul class="summary">' + rows.join("") + '</ul><p class="grand"><span>Total to pay</span><strong>' + rupees(total) + "</strong></p>"
      : '<p class="games-hint">Pick at least one game in step 2 or add a team in step 3. Your total will appear here.</p>';
    $("#payBtn").textContent = total ? "Pay " + rupees(total) : "Pay";
    $("#barTotal").textContent = rupees(total);
  }

  /* ---------- validation ---------- */
  function validate() {
    var errs = [];
    document.querySelectorAll("[aria-invalid]").forEach(function (n) { n.removeAttribute("aria-invalid"); });
    function bad(msg, node) {
      errs.push({ msg: msg, node: node });
      if (node) node.setAttribute("aria-invalid", "true");
    }
    var c = state.contact;
    if (!c.familyId.trim()) bad("Enter your family ID.", $('[data-contact="familyId"]'));
    if (!/^[6-9]\d{9}$/.test(cleanPhone(c.phone))) bad("Enter a valid 10-digit WhatsApp number.", $('[data-contact="phone"]'));
    if (c.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) bad("Check the email address.", $('[data-contact="email"]'));

    var anyGame = false;
    state.players.forEach(function (p, i) {
      var card = $('[data-pid="' + p.id + '"]');
      var label = p.name.trim() || "Player " + (i + 1);
      var ids = Object.keys(p.games);
      var blank = !p.name.trim() && !p.dob && !p.gender && !ids.length;
      if (blank && state.players.length > 1) { bad(label + " is empty. Fill it in or remove it.", card.querySelector('[data-pf="name"]')); return; }
      if (blank) return;
      if (!p.name.trim()) bad("Enter a name for player " + (i + 1) + ".", card.querySelector('[data-pf="name"]'));
      if (!p.gender) bad("Choose a gender for " + label + ".", card.querySelector('[data-pf="gender"]'));
      if (!p.dob) bad("Enter the date of birth for " + label + ".", card.querySelector('[data-pf="dob"]'));
      else if (!playerGroup(p)) bad(label + "'s date of birth doesn't fall in any age group.", card.querySelector('[data-pf="dob"]'));
      if (p.dob && playerGroup(p) && !ids.length) bad("Pick at least one game for " + label + ", or remove this player.", card.querySelector(".game-list"));
      ids.forEach(function (id) {
        if (ACT[id].type === "pair" && !String(p.games[id].partner || "").trim()) {
          bad("Enter " + label + "'s partner for " + ACT[id].name + ".", card.querySelector('[data-partner="' + id + '"]'));
        }
      });
      if (ids.length) anyGame = true;
    });

    state.teams.forEach(function (t, i) {
      var card = $('[data-tid="' + t.id + '"]');
      var label = t.teamName.trim() || "Team " + (i + 1);
      var a = ACT[t.activityId], g = GROUP[t.groupId];
      if (!a) { bad("Choose a game for " + label + ".", card.querySelector('[data-tf="activityId"]')); return; }
      if (!g) bad("Choose an age group for " + label + ".", card.querySelector('[data-tf="groupId"]'));
      if (!t.teamName.trim()) bad("Enter a team name for team " + (i + 1) + ".", card.querySelector('[data-tf="teamName"]'));
      var filled = t.members.filter(function (m) { return m.name.trim() || m.dob; });
      if (filled.length < a.teamMin) bad(label + " needs at least " + a.teamMin + " members.", card.querySelector(".members"));
      t.members.forEach(function (m, mi) {
        var row = card.querySelector('[data-mi="' + mi + '"]');
        if (!m.name.trim() && !m.dob) return;
        if (!m.name.trim()) bad("Enter the name of member " + (mi + 1) + " in " + label + ".", row.querySelector('[data-mf="name"]'));
        var age = ageOn(m.dob);
        if (age == null) bad("Enter the date of birth of member " + (mi + 1) + " in " + label + ".", row.querySelector('[data-mf="dob"]'));
        else if (g && (age < g.min || age > g.max)) bad((m.name.trim() || "Member " + (mi + 1)) + " will be " + age + " on " + formatRefDate() + " and can't play in the " + g.label + " group.", row.querySelector('[data-mf="dob"]'));
      });
      if (a.womenOnly && !t.womenConfirm) bad("Confirm that all members of " + label + " are women.", card.querySelector('[data-tf="womenConfirm"]'));
      anyGame = true;
    });

    if (!anyGame) bad("Pick at least one game or add a team.", $("#players .game-list") || $("#players"));
    if (!$("#agree").checked) bad("Tick the box to accept the event terms.", $("#agree"));
    return errs;
  }

  function showErrors(errs) {
    var box = $("#errors");
    if (!errs.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.innerHTML = "<p><strong>Fix " + (errs.length === 1 ? "this" : "these " + errs.length + " things") + " before paying:</strong></p><ul>" +
      errs.map(function (e, i) { return '<li><button type="button" data-err="' + i + '">' + esc(e.msg) + "</button></li>"; }).join("") + "</ul>";
    box.hidden = false;
    box._errs = errs;
  }

  /* ---------- payload ---------- */
  function buildPayload() {
    var players = state.players.filter(function (p) { return Object.keys(p.games).length; }).map(function (p) {
      return {
        name: p.name.trim(), gender: p.gender, dob: p.dob,
        games: Object.keys(p.games).map(function (id) {
          return { id: id, partner: ACT[id].type === "pair" ? String(p.games[id].partner || "").trim() : "" };
        })
      };
    });
    var teams = state.teams.map(function (t) {
      return {
        activityId: t.activityId, groupId: t.groupId, teamName: t.teamName.trim(), womenConfirm: !!t.womenConfirm,
        members: t.members.filter(function (m) { return m.name.trim() || m.dob; })
          .map(function (m) { return { name: m.name.trim(), dob: m.dob }; })
      };
    });
    return {
      contact: {
        familyId: state.contact.familyId.trim(), phone: cleanPhone(state.contact.phone),
        email: state.contact.email.trim()
      },
      players: players, teams: teams, clientTotal: computeTotal()
    };
  }

  /* ---------- server & payment ---------- */
  function api(action, data) {
    return fetch(C.appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: action, data: data })
    }).then(function (r) {
      if (!r.ok) throw new Error("The registration server didn't respond (" + r.status + "). Try again in a minute.");
      return r.json();
    }).then(function (j) {
      if (!j.ok) throw new Error(j.error || "The registration couldn't be saved. Try again.");
      return j;
    });
  }

  function loadRazorpay() {
    return new Promise(function (resolve, reject) {
      if (window.Razorpay) return resolve();
      var s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = resolve;
      s.onerror = function () { reject(new Error("The payment window couldn't load. Check your internet connection and try again.")); };
      document.head.appendChild(s);
    });
  }

  function openCheckout(order, payload) {
    var failMsg = "";
    var rzp = new window.Razorpay({
      key: order.keyId,
      amount: order.amount * 100,
      currency: "INR",
      name: C.eventName,
      description: "Registration " + order.regId,
      order_id: order.orderId,
      prefill: { email: payload.contact.email, contact: payload.contact.phone },
      notes: { registration_id: order.regId, family_id: payload.contact.familyId.slice(0, 250) },
      theme: { color: "#14233C" },
      handler: function (resp) {
        setBusy(true, "Confirming your payment…");
        api("verify", {
          regId: order.regId,
          razorpay_order_id: resp.razorpay_order_id,
          razorpay_payment_id: resp.razorpay_payment_id,
          razorpay_signature: resp.razorpay_signature
        }).then(function (r) {
          showPaid(order, payload, r.paymentId || resp.razorpay_payment_id);
        }).catch(function () {
          showResult("pending", order, payload,
            "Your payment went through (payment ID " + resp.razorpay_payment_id + ") but we couldn't confirm it automatically. Keep this ID. The organisers will confirm it from Razorpay.");
        }).then(function () { setBusy(false); });
      },
      modal: {
        ondismiss: function () {
          showResult("pending", order, payload, failMsg || "You closed the payment window before paying.");
        }
      }
    });
    rzp.on("payment.failed", function (r) {
      failMsg = (r && r.error && r.error.description) || "The payment failed.";
    });
    rzp.open();
  }

  function setBusy(on, label) {
    busy = on;
    var b = $("#payBtn");
    b.disabled = on;
    if (on) b.textContent = label || "Please wait…";
    else renderSummary();
  }

  /* ---------- result screens ---------- */
  function listForResult(payload) {
    var items = [];
    payload.players.forEach(function (p) {
      items.push("<li><strong>" + esc(p.name) + "</strong>: " + esc(p.games.map(function (g) {
        return ACT[g.id].name + (g.partner ? " with " + g.partner : "");
      }).join(", ")) + "</li>");
    });
    payload.teams.forEach(function (t) {
      items.push("<li><strong>" + esc(t.teamName) + "</strong>: " + esc(ACT[t.activityId].name) + ", ages " + esc(GROUP[t.groupId].label) + "</li>");
    });
    return '<ul class="result-list">' + items.join("") + "</ul>";
  }

  function showPaid(order, payload, paymentId) {
    showResult("paid", order, payload, paymentId);
  }

  function showResult(kind, order, payload, extra) {
    pendingOrder = kind === "pending" ? { order: order, payload: payload } : null;
    $("#regForm").hidden = true;
    $("#totalbar").hidden = true;
    var r = $("#result");
    var html;
    if (kind === "paid") {
      html = '<div class="ticket">' +
        '<p class="ticket-label">Registration ID</p><p class="ticket-id">' + esc(order.regId) + "</p>" +
        '<p class="ticket-paid">' + rupees(order.amount) + (extra === "test" ? " (not charged)" : " paid") + "</p></div>" +
        "<h2>You're registered</h2>" +
        "<p>Keep this registration ID handy, or take a screenshot of this page. Show it at the help desk on the first day." +
        (DEMO || extra === "test" ? "" : " Payment ID: " + esc(extra) + ".") + "</p>" +
        (DEMO ? '<p class="notice">Demo mode: nothing was saved and no payment was taken.</p>' : "") +
        (extra === "test" ? '<p class="notice">Test mode: saved to the sheet without payment.</p>' : "") +
        listForResult(payload) +
        '<button type="button" class="btn-add" data-action="restart">Register someone else</button>';
    } else {
      html = '<div class="ticket ticket-pending">' +
        '<p class="ticket-label">Registration ID</p><p class="ticket-id">' + esc(order.regId) + "</p>" +
        '<p class="ticket-paid">' + rupees(order.amount) + " not paid yet</p></div>" +
        "<h2>Payment not completed</h2>" +
        "<p>" + esc(extra) + " Your details are saved, but your entry is confirmed only after payment.</p>" +
        '<button type="button" class="btn-pay" data-action="retry-pay">Pay ' + rupees(order.amount) + "</button>" +
        '<button type="button" class="btn-link" data-action="back-to-form">Go back and change the details</button>';
    }
    r.innerHTML = html;
    r.hidden = false;
    window.scrollTo({ top: r.offsetTop - 16, behavior: "smooth" });
  }

  function submit(e) {
    e.preventDefault();
    if (busy) return;
    var errs = validate();
    showErrors(errs);
    if (errs.length) {
      $("#errors").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    var payload = buildPayload();

    if (DEMO) {
      var order = { regId: "DEMO-" + String(Date.now()).slice(-4), amount: payload.clientTotal };
      showPaid(order, payload, "demo");
      return;
    }

    setBusy(true, "Saving your registration…");
    api("create", payload)
      .then(function (order) {
        if (order.testMode) {
          setBusy(false);
          showResult("paid", order, payload, "test");
          return;
        }
        return loadRazorpay().then(function () {
          setBusy(false);
          openCheckout(order, payload);
        });
      })
      .catch(function (err) {
        setBusy(false);
        showErrors([{ msg: err.message }]);
      });
  }

  /* ---------- events ---------- */
  function playerOf(node) {
    var card = node.closest("[data-pid]");
    if (!card) return null;
    var id = +card.getAttribute("data-pid");
    return state.players.filter(function (p) { return p.id === id; })[0];
  }
  function teamOf(node) {
    var card = node.closest("[data-tid]");
    if (!card) return null;
    var id = +card.getAttribute("data-tid");
    return state.teams.filter(function (t) { return t.id === id; })[0];
  }

  document.addEventListener("input", function (e) {
    var t = e.target, p, tm;
    if (t.hasAttribute("aria-invalid")) t.removeAttribute("aria-invalid");
    if (t.dataset.contact) { state.contact[t.dataset.contact] = t.value; return; }
    if (t.dataset.pf === "name" && (p = playerOf(t))) { p.name = t.value; renderSummary(); return; }
    if (t.dataset.partner && (p = playerOf(t))) { p.games[t.dataset.partner].partner = t.value; return; }
    if (t.dataset.tf === "teamName" && (tm = teamOf(t))) { tm.teamName = t.value; renderSummary(); return; }
    if (t.dataset.mf && (tm = teamOf(t))) {
      var mi = +t.closest("[data-mi]").getAttribute("data-mi");
      tm.members[mi][t.dataset.mf] = t.value;
    }
  });

  document.addEventListener("change", function (e) {
    var t = e.target, p, tm;
    if (t.dataset.pf === "gender" && (p = playerOf(t))) { p.gender = t.value; return; }
    if (t.dataset.pf === "dob" && (p = playerOf(t))) { p.dob = t.value; refreshPlayerGames(p); renderSummary(); return; }
    if (t.dataset.game && (p = playerOf(t))) {
      if (t.checked) p.games[t.dataset.game] = { partner: "" };
      else delete p.games[t.dataset.game];
      p.dob && refreshPlayerGames(p);
      var focusBack = $('[data-pid="' + p.id + '"] [data-game="' + t.dataset.game + '"]');
      if (focusBack) focusBack.focus();
      if (t.checked && ACT[t.dataset.game].type === "pair") {
        var partner = $('[data-pid="' + p.id + '"] [data-partner="' + t.dataset.game + '"]');
        if (partner) partner.focus();
      }
      renderSummary();
      return;
    }
    if ((t.dataset.tf === "activityId" || t.dataset.tf === "groupId" || t.dataset.tf === "womenConfirm") && (tm = teamOf(t))) {
      if (t.dataset.tf === "womenConfirm") { tm.womenConfirm = t.checked; return; }
      if (t.dataset.tf === "activityId") {
        tm.activityId = t.value;
        var a = ACT[tm.activityId];
        if (!a || a.groups.indexOf(tm.groupId) === -1) tm.groupId = a && a.groups.length === 1 ? a.groups[0] : "";
        tm.womenConfirm = false;
      }
      if (t.dataset.tf === "groupId") tm.groupId = t.value;
      var idx = state.teams.indexOf(tm);
      var card = $('[data-tid="' + tm.id + '"]');
      card.outerHTML = teamHtml(tm, idx);
      var again = $('[data-tid="' + tm.id + '"] [data-tf="' + t.dataset.tf + '"]');
      if (again) again.focus();
      renderSummary();
    }
  });

  document.addEventListener("click", function (e) {
    var errBtn = e.target.closest("[data-err]");
    if (errBtn) {
      var err = $("#errors")._errs[+errBtn.getAttribute("data-err")];
      if (err && err.node) {
        err.node.scrollIntoView({ behavior: "smooth", block: "center" });
        if (err.node.focus) err.node.focus({ preventScroll: true });
      }
      return;
    }
    var b = e.target.closest("[data-action]");
    if (!b) return;
    var act = b.getAttribute("data-action"), p, tm;
    if (act === "add-player") {
      state.players.push(newPlayer());
      renderPlayers();
      var cards = document.querySelectorAll(".player");
      cards[cards.length - 1].querySelector("input").focus();
    } else if (act === "remove-player" && (p = playerOf(b))) {
      state.players.splice(state.players.indexOf(p), 1);
      renderPlayers(); renderSummary();
    } else if (act === "add-team") {
      state.teams.push(newTeam());
      renderTeams();
      var tcards = document.querySelectorAll(".team");
      tcards[tcards.length - 1].querySelector("select").focus();
    } else if (act === "remove-team" && (tm = teamOf(b))) {
      state.teams.splice(state.teams.indexOf(tm), 1);
      renderTeams(); renderSummary();
    } else if (act === "add-member" && (tm = teamOf(b))) {
      tm.members.push({ name: "", dob: "" });
      var box = $('[data-tid="' + tm.id + '"] .members');
      box.innerHTML = membersHtml(tm);
      box.querySelector('[data-mi="' + (tm.members.length - 1) + '"] input').focus();
      renderSummary();
    } else if (act === "remove-member" && (tm = teamOf(b))) {
      tm.members.splice(+b.closest("[data-mi]").getAttribute("data-mi"), 1);
      $('[data-tid="' + tm.id + '"] .members').innerHTML = membersHtml(tm);
      renderSummary();
    } else if (act === "retry-pay" && pendingOrder) {
      var po = pendingOrder;
      loadRazorpay().then(function () { openCheckout(po.order, po.payload); })
        .catch(function (err) { alert(err.message); });
    } else if (act === "back-to-form") {
      $("#result").hidden = true;
      $("#regForm").hidden = false;
      $("#totalbar").hidden = false;
      $("#review").scrollIntoView({ behavior: "smooth" });
    } else if (act === "restart") {
      window.location.reload();
    }
  });

  $("#regForm").addEventListener("submit", submit);

  /* ---------- start ---------- */
  renderStatic();
  state.players.push(newPlayer());
  renderPlayers();
  renderTeams();
  renderSummary();
})();
