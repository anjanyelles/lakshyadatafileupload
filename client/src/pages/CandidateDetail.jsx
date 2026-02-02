import { useParams } from "react-router-dom";

const CandidateDetail = () => {
  const { id } = useParams();

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Candidate profile</h1>
      <p className="text-sm text-slate-600">Candidate ID: {id}</p>
    </section>
  );
};

export default CandidateDetail;
