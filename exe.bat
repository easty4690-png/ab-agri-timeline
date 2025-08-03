@echo off
REM *************************************************************
REM * Batch file to run the Gantt Chart Creator Python script.  *
REM *                                                            *
REM * This script assumes that Python is installed and added to *
REM * the PATH environment variable.  When executed, it will    *
REM * call the Python interpreter on the gantt_creator_gui.py    *
REM * script (graphical version) located in the same folder as   *
REM * this batch file.                                           *
REM * After the script completes, the command window will pause  *
REM * so you can read any output messages.                       *
REM *************************************************************

SET "SCRIPT_DIR=%~dp0"
REM Name of the Python script to run.  Update this variable
REM if you wish to switch between the CLI and GUI versions.
SET "SCRIPT_NAME=gantt_creator_gui.py"

IF NOT EXIST "%SCRIPT_DIR%%SCRIPT_NAME%" (
    echo Cannot find %SCRIPT_NAME% in %SCRIPT_DIR%
    pause
    exit /b 1
)

echo Running Gantt Chart Creator...
python "%SCRIPT_DIR%%SCRIPT_NAME%"
echo.
echo Script finished.  Press any key to close this window.
pause > nul
