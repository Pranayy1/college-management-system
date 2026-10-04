import AppLayout from "../../components/layout/AppLayout";
import { facultyNavigation } from "../../config/navigation";
import { resolveImageUrl } from "../../utils/imageUrl";

const getFacultyProfile = ({
                             user,
                             baseUrl,
                             imgBust,
                           }) => {
  const lastLoginRaw =
      user?.lastlogin ??
      user?.lastLogin ??
      "";

  let lastLogin = "N/A";

  if (lastLoginRaw) {
    const date = new Date(lastLoginRaw);

    lastLogin = Number.isNaN(date.getTime())
        ? String(lastLoginRaw)
        : date.toLocaleDateString();
  }

  return {
    image: `${resolveImageUrl(
        user?.profilepic,
        "/uploads/faculties/default.png",
        baseUrl
    )}?v=${imgBust}`,
    fallbackImage: `${baseUrl}/uploads/faculties/default.png`,
    imageAlt: "Faculty",
    title:
        user?.name ||
        user?.fullname ||
        "Faculty Member",
    subtitle: "Faculty Portal",
    details: user
        ? [
          {
            label: "Status",
            value: "Online",
            status: true,
            active: true,
          },
          {
            label: "Last Auth",
            value: lastLogin,
            monospace: true,
            bold: true,
          },
        ]
        : [],
  };
};

const FacultyLayout = () => {
  return (
      <AppLayout
          role="faculty"
          title="Faculty Panel"
          profileEndpoint="/api/faculty/profile"
          navigation={facultyNavigation}
          updateEvent="facultyUserUpdated"
          getProfile={getFacultyProfile}
      />
  );
};

export default FacultyLayout;