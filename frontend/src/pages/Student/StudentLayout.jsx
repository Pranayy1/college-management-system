import AppLayout from "../../components/layout/AppLayout";
import { studentNavigation } from "../../config/navigation";
import { resolveImageUrl } from "../../utils/imageUrl";

const StudentLayout = () => {
  const getProfile = ({
                        user,
                        baseUrl,
                      }) => {
    return {
      image: resolveImageUrl(
          user?.profilepic,
          "/uploads/students/default.png",
          baseUrl
      ),
      fallbackImage: `${baseUrl}/uploads/students/default.png`,
      imageAlt: "Profile",
      title: user
          ? `${user.firstname || ""} ${user.lastname || ""}`.trim()
          : "Student",
      subtitle: "Student Portal",
      details: user
          ? [
            {
              label: "Roll Number",
              value: user.rollnumber || "N/A",
              monospace: true,
              bold: true,
            },
            {
              label: "Status",
              value: "Active",
              status: true,
              active: true,
            },
          ]
          : [],
    };
  };

  return (
      <AppLayout
          role="student"
          title="Student Panel"
          profileEndpoint="/api/student/profile"
          navigation={studentNavigation}
          getProfile={getProfile}
      />
  );
};

export default StudentLayout;