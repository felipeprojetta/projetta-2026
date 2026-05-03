@echo off
title Projetta - Servidor Local
cd /d "%~dp0"

echo.
echo  =====================================================
echo    PROJETTA - servidor local em http://localhost:8000
echo  =====================================================
echo.

REM Verifica que estamos na pasta certa (com index.html)
if not exist "%~dp0index.html" (
  echo  ===============================================
  echo   ERRO: index.html nao foi encontrado!
  echo  ===============================================
  echo.
  echo  Esta pasta nao tem o arquivo index.html.
  echo  Provavelmente o ZIP nao foi extraido corretamente.
  echo.
  echo  Como corrigir:
  echo    1. Feche essa janela
  echo    2. Va onde esta o projetta.zip
  echo    3. Clique COM BOTAO DIREITO no projetta.zip
  echo    4. Escolha "Extrair tudo..." ^(NAO duplo clique^)
  echo    5. Extraia para a pasta desejada
  echo    6. Entre na pasta "projetta" extraida
  echo    7. Clique no iniciar.bat de DENTRO dessa pasta
  echo.
  echo  Pasta atual: %~dp0
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0scripts" (
  echo  ERRO: pasta "scripts" nao foi encontrada nessa pasta.
  echo  Voce extraiu o ZIP completo? Veja o README.md.
  echo.
  echo  Pasta atual: %~dp0
  pause
  exit /b 1
)

echo  Para fechar o sistema: feche esta janela preta.
echo  Os dados ficam salvos no localStorage do navegador.
echo.

REM Detecta Python
set "PY_CMD="
py --version >nul 2>&1 && set "PY_CMD=py"
if not defined PY_CMD (
  python --version >nul 2>&1 && set "PY_CMD=python"
)

if not defined PY_CMD (
  echo  ===============================================
  echo   ERRO: Python nao foi encontrado no seu PC
  echo  ===============================================
  echo.
  echo  O Projetta precisa do Python para rodar.
  echo  Eh gratis e instala em 1 clique pela Microsoft Store:
  echo.
  echo    1. Aperte a tecla Windows
  echo    2. Digite:  python
  echo    3. Clique no resultado "Get Python" ^(Microsoft Store^)
  echo    4. Na pagina da Store, clique em "Instalar"
  echo    5. Quando terminar ^(uns 30 segundos^), volte aqui
  echo       e clique em iniciar.bat de novo
  echo.
  echo  ===============================================
  echo.
  pause
  exit /b 1
)

echo  Python detectado: %PY_CMD%
echo  index.html encontrado, subindo servidor...
echo.

REM Agenda abertura do navegador em 3 segundos (em paralelo)
start "" /min cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:8000"

REM Sobe o servidor (bloqueante - mantem essa janela aberta)
%PY_CMD% -m http.server 8000

echo.
echo  =====================================================
echo    Servidor encerrado.
echo  =====================================================
echo.
pause
