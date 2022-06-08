#
# Copyright 2022 Elyra Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

import os
import sys
import socket
from subprocess import Popen
from subprocess import PIPE
from traitlets.config import SingletonConfigurable


class StreamlitManager(SingletonConfigurable):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.streamlit_instances = {}

    def start(self, streamlit_app_filepath):
        streamlit_app = StreamlitApplication(streamlit_app_filepath=streamlit_app_filepath)
        streamlit_app.start()
        self.streamlit_instances[streamlit_app_filepath] = streamlit_app
        return streamlit_app.port

    def stop(self, streamlit_app_filepath):
        streamlit_app = self.streamlit_instances.get(streamlit_app_filepath)
        streamlit_app.stop()


class StreamlitApplication:
    def __init__(self, streamlit_app_filepath):
        self.port = get_open_port()
        self.app_start_dir = os.path.dirname(streamlit_app_filepath)
        self.streamlit_cmd = [sys.executable, "-m", "streamlit", "run", os.path.basename(streamlit_app_filepath),
                              "--browser.gatherUsageStats=false",  # turn off usage upload to streamlit
                              "--server.runOnSave=true",           # auto refresh app on save
                              "--server.headless=true",            # run headless, avoids email sign up
                              "--server.port", self.port]
        self.process = None

    def start(self):
        self.process = Popen(self.streamlit_cmd, cwd=self.app_start_dir, stdout=PIPE)

        # Voodoo magic, needs to 'hit' the process otherwise server will not serve
        self.process.stdout.readline()

    def stop(self):
        self.process.terminate()

    def is_alive(self):
        return self.process.poll()


def get_open_port() -> str:
    sock = socket.socket()
    sock.bind(('', 0))
    return str(sock.getsockname()[1])
