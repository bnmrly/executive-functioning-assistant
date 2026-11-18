package com.wesbos.homehq;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
import android.webkit.WebResourceResponse;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Calendar;
import java.util.HashMap;
import java.util.Map;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Reads Beth's synced calendar on WebView's background request thread. */
final class CalendarEvents {
  static WebResourceResponse response(Context context, Uri request) {
    String body;
    try {
      body = read(context, request).toString();
    } catch (SecurityException e) {
      body = "{\"status\":\"permission_required\"}";
    } catch (RuntimeException | JSONException e) {
      body = "{\"status\":\"unavailable\"}";
    }
    Map<String, String> headers = new HashMap<>();
    headers.put("Cache-Control", "no-store");
    headers.put("X-Content-Type-Options", "nosniff");
    return new WebResourceResponse("application/json", "utf-8", 200, "OK", headers,
        new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)));
  }

  private static JSONObject read(Context context, Uri request) throws JSONException {
    JSONObject result = new JSONObject();
    if (context.checkSelfPermission(Manifest.permission.READ_CALENDAR) != PackageManager.PERMISSION_GRANTED) {
      return result.put("status", "permission_required");
    }
    ContentResolver resolver = context.getContentResolver();
    long calendarId;
    try (Cursor calendars = resolver.query(CalendarContract.Calendars.CONTENT_URI,
        new String[] {"_id", "calendar_displayName", "sync_events", "visible"},
        "calendar_displayName IN (?, ?, ?)", new String[] {"Beth's Calendar", "Beth’s Calendar", "Beth"}, null)) {
      if (calendars == null) return result.put("status", "unavailable");
      if (!calendars.moveToFirst()) return result.put("status", "calendar_missing");
      if (calendars.getCount() > 1) return result.put("status", "multiple_calendars");
      calendarId = calendars.getLong(0);
      result.put("calendar", calendars.getString(1));
      if (calendars.getInt(2) == 0 || calendars.getInt(3) == 0) {
        return result.put("status", "sync_disabled");
      }
    }
    Calendar day = Calendar.getInstance();
    day.set(Calendar.HOUR_OF_DAY, 0);
    day.set(Calendar.MINUTE, 0);
    day.set(Calendar.SECOND, 0);
    day.set(Calendar.MILLISECOND, 0);
    String requestedStart = request.getQueryParameter("start");
    String requestedDays = request.getQueryParameter("days");
    int days = 2;
    if (requestedStart != null) {
      java.text.SimpleDateFormat format = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.ROOT);
      format.setLenient(false);
      java.text.ParsePosition position = new java.text.ParsePosition(0);
      java.util.Date date = format.parse(requestedStart, position);
      if (date == null || position.getIndex() != requestedStart.length()
          || !format.format(date).equals(requestedStart)) {
        return result.put("status", "invalid_range");
      }
      day.setTime(date);
    }
    if (requestedDays != null) {
      try {
        days = Integer.parseInt(requestedDays);
      } catch (NumberFormatException e) {
        return result.put("status", "invalid_range");
      }
      if (days < 1 || days > 31) return result.put("status", "invalid_range");
    }
    long start = day.getTimeInMillis();
    day.add(Calendar.DATE, days);
    long end = day.getTimeInMillis();
    Uri.Builder range = CalendarContract.Instances.CONTENT_URI.buildUpon();
    // All-day instances use UTC dates. Include neighbouring UTC days before converting them.
    ContentUris.appendId(range, start - 86400000L);
    ContentUris.appendId(range, end + 86400000L);
    JSONArray events = new JSONArray();
    try (Cursor instances = resolver.query(range.build(),
        new String[] {CalendarContract.Instances.EVENT_ID, CalendarContract.Instances.TITLE,
          CalendarContract.Instances.BEGIN, CalendarContract.Instances.END, CalendarContract.Instances.ALL_DAY},
        "calendar_id = ? AND eventStatus != ?",
        new String[] {Long.toString(calendarId), Integer.toString(CalendarContract.Events.STATUS_CANCELED)},
        CalendarContract.Instances.BEGIN + " ASC, " + CalendarContract.Instances.EVENT_ID + " ASC")) {
      if (instances == null) return result.put("status", "unavailable");
      while (instances.moveToNext()) {
        boolean allDay = instances.getInt(4) != 0;
        long begin = instances.getLong(2);
        long finish = instances.getLong(3);
        if (allDay) {
          begin = localDate(begin);
          finish = localDate(finish);
        }
        if (begin >= end || finish <= start) continue;
        events.put(new JSONObject().put("id", instances.getLong(0))
            .put("title", instances.isNull(1) ? "Untitled event" : instances.getString(1))
            .put("start", begin).put("end", finish).put("allDay", allDay));
      }
    }
    return result.put("status", "ok").put("events", events).put("dayStart", start);
  }

  private static long localDate(long utcMillis) {
    Calendar utc = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
    utc.setTimeInMillis(utcMillis);
    Calendar local = Calendar.getInstance();
    local.clear();
    local.set(utc.get(Calendar.YEAR), utc.get(Calendar.MONTH), utc.get(Calendar.DATE));
    return local.getTimeInMillis();
  }
}
