import json

from tornado import web

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
from jupyter_server_proxy.handlers import LocalProxyHandler
from streamlit_extension.process_manager import StreamlitManager
import tornado


class RouteHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.web.authenticated
    def get(self):
        appList = StreamlitManager.instance().list()
        instances = {}
        for key in appList:
          instances[key] = appList[key].internal_host_url
        self.finish(json.dumps(instances))

    @tornado.web.authenticated
    def post(self):
        # parse filename and location
        json_payload = self.get_json_body()
        streamlit_app_filepath = json_payload['file']

        streamlit_app = StreamlitManager.instance().start(streamlit_app_filepath=streamlit_app_filepath)

        self.finish(json.dumps({
            "url": f"/proxy/{streamlit_app.port}/"
        }))

    @tornado.web.authenticated
    def delete(self):
        # parse filename and location
        json_payload = self.get_json_body()
        streamlit_app_filepath = json_payload['file']

        StreamlitManager.instance().stop(streamlit_app_filepath=streamlit_app_filepath)


class StreamlitProxyHandler(LocalProxyHandler):
    """
    A handler that proxies the streamlit application to the notebook server.
    The streamlit application is assumed to be running on `localhost`.
    The functions `http_get`, `open`, `post`, `put`, `delete`,
    `head`, `patch`, `options`, and `proxy` are all overriding
    the base class with our own request handler parameters
    of `port_id` and `proxied_path`.
    """

    async def http_get(self, port_id, proxied_path):
        return await self.proxy(port_id, proxied_path)

    async def open(self, port_id, proxied_path):
        return await super().proxy_open("localhost", port_id, proxied_path)

    # We have to duplicate all these for now

    def post(self, port_id, proxied_path):
        return self.proxy(port_id, proxied_path)

    def put(self, port_id, proxied_path):
        return self.proxy(port_id, proxied_path)

    def delete(self, port_id, proxied_path):
        return self.proxy(port_id, proxied_path)

    def head(self, port_id, proxied_path):
        return self.proxy(port_id, proxied_path)

    def patch(self, port_id, proxied_path):
        return self.proxy(port_id, proxied_path)

    def options(self, port_id, proxied_path):
        return self.proxy(port_id, proxied_path)

    def proxy(self, port_id, proxied_path):
        return super().proxy("localhost", port_id, proxied_path)


def setup_handlers(web_app):
    host_pattern = ".*$"

    port_regex = r"(?P<port_id>[\w]+)"
    proxied_path_regex = r"(?P<proxied_path>.+)"
    base_url = web_app.settings["base_url"]
    route_pattern = url_path_join(base_url, "streamlit", "app")
    proxy_pattern = url_path_join(base_url, f"/proxy/{port_regex}/{proxied_path_regex}")
    handlers = [(route_pattern, RouteHandler),
                (proxy_pattern, StreamlitProxyHandler)]
    web_app.add_handlers(host_pattern, handlers)
