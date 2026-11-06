import { ClinicJoinForm } from '@/components/clinic-join/ClinicJoinForm';
export default async function Page({params}:{params:Promise<{token:string}>}) {const {token}=await params;return <ClinicJoinForm token={token}/>}
