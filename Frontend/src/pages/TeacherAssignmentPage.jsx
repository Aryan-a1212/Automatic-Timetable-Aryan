// ... existing code ...

// Inside your component's render method, where you have the select dropdown for assigned teachers:
<select
  value={subject.assignedTeacher || ""}
  onChange={(e) => handleAssignTeacher(subject._id, e.target.value)}
>
  <option value="">Select</option>
  {teachers.map((teacher) => (
    <option key={teacher._id} value={teacher._id}>
      {teacher.name}
    </option>
  ))}
</select>

// Add this function to your component (e.g., after fetchTeachersAndSubjects)
const handleAssignTeacher = async (subjectId, teacherId) => {
  try {
    await axios.put(`/api/subjects/${subjectId}/assign`, { teacherId });
    // Refresh subjects list to show the updated assigned teacher
    fetchTeachersAndSubjects(); // Assuming this function fetches both teachers and subjects
  } catch (error) {
    console.error("Error assigning teacher:", error);
  }
};

// ... existing code ...