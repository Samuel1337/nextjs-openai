import { withPageAuthRequired } from "@auth0/nextjs-auth0";

export default function TokenTopup(props) {
    return (
        <div>
            <h1>This is the token topup page</h1>
        </div>
    );
  }
  
export const getServerSideProps = withPageAuthRequired(() => {
    return {
        props: {},
    };
});