"""主题仅接收结构化字段，不执行洛谷页面或用户传入的 CSS。"""
import math
import re
from urllib.parse import urlsplit

from app.core.exceptions import ValidationError

_COLOR = re.compile(r"(?:#[0-9a-fA-F]{3,4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|(?:rgb|hsl)a?\([0-9.,%\s+/-]+\)|transparent|black|white)")


def color(value):
    if not isinstance(value, str) or not _COLOR.fullmatch(value.strip()):
        raise ValidationError("主题颜色格式不正确")
    return value.strip()


def number(value, low, high):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
        raise ValidationError("主题数值超出范围")
    return value


def normalize_config(raw: dict) -> dict:
    if not isinstance(raw, dict):
        raise ValidationError("主题配置格式不正确")
    nav, body = raw.get("lNavi", {}), raw.get("lBody", {})
    if not isinstance(nav, dict) or not isinstance(body, dict):
        raise ValidationError("主题配置格式不正确")
    opts = body.get("midOpts", {})
    if not isinstance(opts, dict):
        raise ValidationError("图片配置格式不正确")
    image = body.get("image") or ""
    if not isinstance(image, str) or len(image) > 2048:
        raise ValidationError("背景图片地址不正确")
    if image:
        parsed = urlsplit(image)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.port not in (None, 443):
            raise ValidationError("背景图片只支持 HTTPS 地址")
    size = opts.get("size", "auto")
    if not isinstance(size, str) or (size not in {"auto", "cover", "contain"} and not re.fullmatch(r"\d{1,4}(?:\.\d+)?(?:\s+\d{1,4}(?:\.\d+)?)?", size)):
        raise ValidationError("图片尺寸不正确")
    repeat = opts.get("repeat", "none")
    if repeat not in {"none", "all", "x", "y"}:
        raise ValidationError("图片重复方式不正确")
    position = opts.get("position", [0, 0])
    if not isinstance(position, list) or len(position) != 2:
        raise ValidationError("图片位置不正确")
    blur = body.get("blur", 0)
    if blur not in (0, 1000, 1010):
        raise ValidationError("毛玻璃档位不正确")
    colors = body.get("color", [])
    if not isinstance(colors, list) or len(colors) > 20:
        raise ValidationError("最多支持 20 个中景颜色")
    # 洛谷使用 ±1000 表示淡出方向，归一化后兼容本站原有的 ±1 配置。
    fade = number(body.get("fade", 0), -1000, 1000)
    fade = 1 if fade > 0 else -1 if fade < 0 else 0
    return {
        "lNavi": {"back": color(nav.get("back", "#ffffff")), "fore": color(nav.get("fore", "#333333")), "logo": color(nav["logo"]) if nav.get("logo") else None},
        "lBody": {
            "back": color(body.get("back", "#efefef")), "image": image,
            "color": [color(v) for v in colors if v], "blur": blur,
            "fade": fade,
            "midOpts": {"degree": number(opts.get("degree", 0), 0, 360), "brightness": number(opts.get("brightness", 0), -100, 100), "repeat": repeat, "size": size, "position": [number(v, 0, 100) for v in position]},
        },
    }
