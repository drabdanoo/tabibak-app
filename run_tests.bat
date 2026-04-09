@echo off
cd /d G:\tabibak-app
set MAESTRO_API_KEY=rb_58yDBtvMEFQXbL9JXRYb8cJo5PiNsPQ3DTTnWQDsce69YHKH4OXvJGZNG9xNlILBSZIFDEFlTBOUgFw4d6xTd42ujJJ9NfrX4Mj
set PYTHONIOENCODING=utf-8
python -X utf8 ios_test_agent.py --ipa https://expo.dev/artifacts/eas/fzSvqV3K2pvpp5uPqgpYZv.ipa --fresh
