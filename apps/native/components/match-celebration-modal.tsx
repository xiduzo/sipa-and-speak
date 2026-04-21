import { useRouter } from "expo-router";
import { Button } from "heroui-native";
import { Modal, Text, View } from "react-native";

interface Props {
  visible: boolean;
  partnerName: string;
  partnerId: string;
  onDismiss: () => void;
}

export function MatchCelebrationModal({ visible, partnerName, partnerId, onDismiss }: Props) {
  const router = useRouter();

  function handlePropose() {
    onDismiss();
    router.push({ pathname: "/propose-meetup", params: { partnerId, partnerName } });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View className="flex-1 bg-background items-center justify-center px-8 gap-6">
        <Text className="text-6xl">🎉</Text>
        <Text className="text-foreground text-3xl font-bold text-center">
          It's a match!
        </Text>
        <Text className="text-muted-foreground text-center text-lg">
          You and {partnerName} are now matched. Propose a meetup to start practising together.
        </Text>
        <View className="w-full gap-3">
          <Button testID="celebration-propose-btn" variant="primary" onPress={handlePropose}>
            <Button.Label>Propose a meetup</Button.Label>
          </Button>
          <Button testID="celebration-dismiss-btn" variant="ghost" onPress={onDismiss}>
            <Button.Label>Maybe later</Button.Label>
          </Button>
        </View>
      </View>
    </Modal>
  );
}
