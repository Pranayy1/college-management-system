import AppLayout from "../../components/layout/AppLayout";
import { adminNavigation } from "../../config/navigation";
import { resolveImageUrl } from "../../utils/imageUrl";

const getAdminProfile = ({
                             user,
                             baseUrl,
                         }) => {
    const lastLogin = user?.lastlogin
        ? new Date(user.lastlogin).toLocaleDateString()
        : "N/A";

    return {
        image: resolveImageUrl(
            user?.logo,
            "/uploads/admin/default.png",
            baseUrl
        ),
        fallbackImage: `${baseUrl}/uploads/admin/default.png`,
        imageAlt: "Logo",
        title: "Administrator",
        subtitle: "Academic Portal",
        details: user
            ? [
                {
                    label: "System Node",
                    value: user.activestatus
                        ? "Online"
                        : "Offline",
                    status: true,
                    active: Boolean(user.activestatus),
                },
                {
                    label: "Last Auth",
                    value: lastLogin,
                    monospace: true,
                },
            ]
            : [],
    };
};

const AdminLayout = () => {
    return (
        <AppLayout
            role="admin"
            title="Academic Management ERP"
            profileEndpoint="/api/admin/profile"
            navigation={adminNavigation}
            getProfile={getAdminProfile}
        />
    );
};

export default AdminLayout;