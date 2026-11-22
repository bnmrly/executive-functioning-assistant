#!/usr/bin/env python3
"""Exercise the production calendar origin guard using a host JDK; no device needed."""
from pathlib import Path
import re
import subprocess
import tempfile

source = (Path(__file__).parent / "src/com/wesbos/homehq/MainActivity.java").read_text()
method = re.search(r"  static boolean calendarPageAllowed[\s\S]*?\n  }", source).group()
constants = "\n".join(re.findall(
    r"  static final (?:String LOCAL_HOST|int LOCAL_PORT|int PREVIEW_PORT) = .*?;", source))
harness = '''
class PreviewCalendarCheck {
CONSTANTS
METHOD
static void check(boolean value) { if (!value) throw new AssertionError(); }
public static void main(String[] args) {
  check(calendarPageAllowed("http", "127.0.0.1", 8765, 8765, false, false));
  check(calendarPageAllowed("http", "127.0.0.1", 5173, 5173, false, true));
  check(!calendarPageAllowed("http", "127.0.0.1", 5173, 5173, false, false));
  check(!calendarPageAllowed("http", "example.com", 5173, 5173, false, true));
  check(!calendarPageAllowed("https", "127.0.0.1", 5173, 5173, false, true));
  check(!calendarPageAllowed("http", "127.0.0.1", 5173, 8765, false, true));
  check(!calendarPageAllowed("http", "127.0.0.1", 5173, 5173, true, true));
  check(!calendarPageAllowed("http", "127.0.0.1", 8000, 8000, false, true));
  System.out.println("Calendar origin checks passed (8 cases)");
}
}
'''.replace("CONSTANTS", constants).replace("METHOD", method)
with tempfile.TemporaryDirectory() as directory:
    path = Path(directory) / "PreviewCalendarCheck.java"
    path.write_text(harness)
    subprocess.run(["java", str(path)], check=True)
