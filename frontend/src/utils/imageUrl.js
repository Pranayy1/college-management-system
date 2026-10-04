export const resolveImageUrl = (image, fallbackPath, baseUrl) => {
    if (!image || image === "default.png") {
        return `${baseUrl}${fallbackPath}`;
    }

    const value = String(image);
    if (/^(https?:|blob:|data:)/i.test(value)) {
        return value;
    }

    if (value.startsWith("/")) {
        return `${baseUrl}${value}`;
    }

    const directory = fallbackPath.slice(0, fallbackPath.lastIndexOf("/"));
    return `${baseUrl}${directory}/${value}`;
};
